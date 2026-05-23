import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface WalletSyncRequest {
  userId: string;
  walletAddress: string;
}

export async function POST(req: Request) {
  try {
    const body: Partial<WalletSyncRequest> = await req.json();
    const { userId, walletAddress } = body;

    // 1. Basic Validation
    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required payload fields: userId or walletAddress' },
        { status: 400 }
      );
    }

    // 2. Database Sync
    // Update the wallet_address column in the users table securely
    const { error: updateError } = await supabase
      .from('users')
      .update({ wallet_address: walletAddress })
      .eq('id', userId);

    if (updateError) {
      // Postgres error code 23505 indicates a unique constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Wallet address is already securely linked to another account' },
          { status: 409 }
        );
      }
      throw new Error(`Failed to update user wallet address database record: ${updateError.message}`);
    }

    // 3. Return Success response
    return NextResponse.json({
      success: true,
      wallet_address: walletAddress,
    });

  } catch (error: any) {
    console.error("Wallet Sync API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
