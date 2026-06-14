import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;

export async function signSession(userId: string): Promise<string> {
    if (!JWT_SECRET) {
        console.warn("WARNING: JWT_SECRET is not set in environment variables. Falling back to insecure secret.");
    }
    const secret = JWT_SECRET || 'insecure-development-secret-do-not-use-in-prod';
    return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export async function verifySession(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    
    if (!token) {
        // Fallback or old unauthenticated sessions (will be rejected to force re-login)
        return null;
    }
    
    const secret = JWT_SECRET || 'insecure-development-secret-do-not-use-in-prod';
    
    try {
        const decoded = jwt.verify(token, secret) as { userId: string };
        return decoded.userId;
    } catch (error) {
        return null;
    }
}
