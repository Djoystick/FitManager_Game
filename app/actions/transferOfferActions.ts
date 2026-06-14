'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { TransferOffer } from '@/lib/types';
import { triggerTransferAchievements } from '@/app/services/achievementService';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function makeOffer(targetPlayerId: string, offeredFc: number, offeredPlayerId?: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (offeredFc < 0) return { success: false, error: 'Invalid FC amount' };

    // Get sender team
    const { data: senderTeam } = await supabaseAdmin.from('teams').select('id, user_id').eq('user_id', userId).single();
    if (!senderTeam) return { success: false, error: 'Team not found' };

    // Get target player and receiver team
    const { data: targetPlayer } = await supabaseAdmin
      .from('players')
      .select('id, team_id, ovr, name')
      .eq('id', targetPlayerId)
      .single();
    if (!targetPlayer) return { success: false, error: 'Target player not found' };

    if (targetPlayer.team_id === senderTeam.id) {
      return { success: false, error: 'You already own this player' };
    }

    // Verify sender has enough FC
    const { data: senderUser } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', userId).single();
    if ((senderUser?.balance_fancoins || 0) < offeredFc) {
      return { success: false, error: 'Not enough FanCoins' };
    }

    // Verify offered player if any
    if (offeredPlayerId) {
      const { data: offeredPlayer } = await supabaseAdmin.from('players').select('id, team_id').eq('id', offeredPlayerId).single();
      if (!offeredPlayer || offeredPlayer.team_id !== senderTeam.id) {
        return { success: false, error: 'Invalid offered player' };
      }
    }

    // Check if an offer already exists from this team for this player
    const { data: existingOffer } = await supabaseAdmin
      .from('transfer_offers')
      .select('id')
      .eq('sender_team_id', senderTeam.id)
      .eq('target_player_id', targetPlayerId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingOffer) {
      return { success: false, error: 'You already have a pending offer for this player' };
    }

    // Insert offer
    const { data: newOffer, error: insertError } = await supabaseAdmin
      .from('transfer_offers')
      .insert({
        sender_team_id: senderTeam.id,
        receiver_team_id: targetPlayer.team_id,
        target_player_id: targetPlayerId,
        offered_fc: offeredFc,
        offered_player_id: offeredPlayerId || null,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Check if receiver is a bot
    const { data: receiverTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', targetPlayer.team_id).single();
    if (receiverTeam?.user_id?.startsWith('bot_')) {
      // Bot logic
      const baseValue = Math.floor(50 * Math.pow(1.10, targetPlayer.ovr));
      // If no player offered, check FC. If player offered, it's more complex, bot might reject swaps for simplicity.
      let accepted = false;
      if (!offeredPlayerId) {
        if (offeredFc >= baseValue * 1.5) {
          accepted = true;
        }
      }

      if (accepted) {
        await acceptOffer(newOffer.id, receiverTeam.user_id); // Pass receiverUserId as bot
      } else {
        await rejectOffer(newOffer.id, receiverTeam.user_id);
      }
      return { success: true, message: 'Offer evaluated by bot.' };
    } else if (receiverTeam?.user_id) {
      // Notify real user
      await supabaseAdmin.from('personal_notifications').insert({
        user_id: receiverTeam.user_id,
        type: 'transfer',
        title: 'New Transfer Offer',
        message: JSON.stringify({
          en: `You received a transfer offer for ${targetPlayer.name}.`,
          ru: `Вы получили трансферное предложение по игроку ${targetPlayer.name}.`,
        }),
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function acceptOffer(offerId: string, botReceiverId?: string) {
  try {
    let userId = botReceiverId;
    if (!userId) {
      const cookieStore = await cookies();
      userId = (await verifySession()) || undefined;
    }
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: offer } = await supabaseAdmin.from('transfer_offers').select('*').eq('id', offerId).single();
    if (!offer) return { success: false, error: 'Offer not found' };
    if (offer.status !== 'pending') return { success: false, error: 'Offer is not pending' };

    const { data: receiverTeam } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!receiverTeam || offer.receiver_team_id !== receiverTeam.id) {
      return { success: false, error: 'Unauthorized to accept this offer' };
    }

    const { data: senderTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', offer.sender_team_id).single();
    if (!senderTeam) return { success: false, error: 'Sender team not found' };

    // Validate sender FC
    const { data: senderUser } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', senderTeam.user_id).single();
    if ((senderUser?.balance_fancoins || 0) < offer.offered_fc) {
      return { success: false, error: 'Sender does not have enough FanCoins anymore' };
    }

    // Validate target player still in receiver team
    const { data: targetPlayer } = await supabaseAdmin.from('players').select('team_id').eq('id', offer.target_player_id).single();
    if (targetPlayer?.team_id !== receiverTeam.id) {
      return { success: false, error: 'Target player is no longer in your team' };
    }

    // Validate offered player if any
    if (offer.offered_player_id) {
      const { data: offeredPlayer } = await supabaseAdmin.from('players').select('team_id').eq('id', offer.offered_player_id).single();
      if (offeredPlayer?.team_id !== offer.sender_team_id) {
        return { success: false, error: 'Offered player is no longer in sender team' };
      }
    }

    // Deduct FC from sender
    if (offer.offered_fc > 0) {
      const { error: deductErr } = await supabaseAdmin.rpc('deduct_fancoins', {
        user_id: senderTeam.user_id,
        amount: offer.offered_fc,
      });
      if (deductErr) return { success: false, error: 'Failed to process FanCoins payment' };

      // Add FC to receiver
      await supabaseAdmin.rpc('increment_fancoins', { u_id: userId, amount: offer.offered_fc });
    }

    // Transfer players
    await supabaseAdmin.from('players').update({ team_id: offer.sender_team_id, lineup_status: 'bench', lineup_slot: null }).eq('id', offer.target_player_id);
    if (offer.offered_player_id) {
      await supabaseAdmin.from('players').update({ team_id: receiverTeam.id, lineup_status: 'bench', lineup_slot: null }).eq('id', offer.offered_player_id);
    }

    // Mark offer accepted
    await supabaseAdmin.from('transfer_offers').update({ status: 'accepted' }).eq('id', offerId);

    // Reject other pending offers for target player
    await supabaseAdmin.from('transfer_offers').update({ status: 'rejected' }).eq('target_player_id', offer.target_player_id).eq('status', 'pending');

    // Reject other pending offers for offered player if any
    if (offer.offered_player_id) {
      await supabaseAdmin.from('transfer_offers').update({ status: 'rejected' }).eq('target_player_id', offer.offered_player_id).eq('status', 'pending');
      await supabaseAdmin.from('transfer_offers').update({ status: 'rejected' }).eq('offered_player_id', offer.offered_player_id).eq('status', 'pending');
    }

    // Notifications
    if (!botReceiverId) {
      await supabaseAdmin.from('personal_notifications').insert({
        user_id: senderTeam.user_id,
        type: 'transfer',
        title: 'Offer Accepted',
        message: JSON.stringify({
          en: `Your transfer offer was accepted!`,
          ru: `Ваше трансферное предложение принято!`,
        }),
      });
    }

    await triggerTransferAchievements(offer.sender_team_id, 'buy');
    await triggerTransferAchievements(receiverTeam.id, 'sell');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectOffer(offerId: string, botReceiverId?: string) {
  try {
    let userId = botReceiverId;
    if (!userId) {
      const cookieStore = await cookies();
      userId = (await verifySession()) || undefined;
    }
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: offer } = await supabaseAdmin.from('transfer_offers').select('receiver_team_id, sender_team_id, status').eq('id', offerId).single();
    if (!offer) return { success: false, error: 'Offer not found' };
    if (offer.status !== 'pending') return { success: false, error: 'Offer is not pending' };

    const { data: receiverTeam } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!receiverTeam || offer.receiver_team_id !== receiverTeam.id) {
      return { success: false, error: 'Unauthorized to reject this offer' };
    }

    await supabaseAdmin.from('transfer_offers').update({ status: 'rejected' }).eq('id', offerId);

    if (!botReceiverId) {
      const { data: senderTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', offer.sender_team_id).single();
      if (senderTeam?.user_id) {
        await supabaseAdmin.from('personal_notifications').insert({
          user_id: senderTeam.user_id,
          type: 'transfer',
          title: 'Offer Rejected',
          message: JSON.stringify({
            en: `Your transfer offer was rejected.`,
            ru: `Ваше трансферное предложение отклонено.`,
          }),
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getIncomingOffers() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data, error } = await supabaseAdmin
      .from('transfer_offers')
      .select('*, target_player:players!transfer_offers_target_player_id_fkey(name, ovr), offered_player:players!transfer_offers_offered_player_id_fkey(name, ovr), sender:teams!transfer_offers_sender_team_id_fkey(name)')
      .eq('receiver_team_id', team.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getOutgoingOffers() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data, error } = await supabaseAdmin
      .from('transfer_offers')
      .select('*, target_player:players!transfer_offers_target_player_id_fkey(name, ovr), offered_player:players!transfer_offers_offered_player_id_fkey(name, ovr), receiver:teams!transfer_offers_receiver_team_id_fkey(name)')
      .eq('sender_team_id', team.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
