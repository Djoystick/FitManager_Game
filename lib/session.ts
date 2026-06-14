import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('CRITICAL: JWT_SECRET is not set in environment variables. Authentication cannot proceed.');
    }
    return secret;
}

export async function signSession(userId: string): Promise<string> {
    const secret = getJWTSecret();
    return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export async function verifySession(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
        return null;
    }

    const secret = getJWTSecret();

    try {
        const decoded = jwt.verify(token, secret) as { userId: string };
        return decoded.userId;
    } catch (error) {
        return null;
    }
}
