import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testGemini() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Say hello world');
    console.log('Gemini says:', result.response.text());
  } catch (error) {
    console.error('Gemini error:', error);
  }
}

testGemini();
