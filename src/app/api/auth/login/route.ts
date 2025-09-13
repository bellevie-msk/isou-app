import { NextResponse } from 'next/server';
import { withSession } from '@/lib/session';
import { IronSession } from 'iron-session';

export const POST = withSession(async (session: IronSession, request: Request) => {
  try {
    const { password } = await request.json();

    if (password === process.env.ADMIN_PASSWORD) {
      // 認証成功
      session.isAuthenticated = true;
      await session.save();
      return NextResponse.json({ success: true });
    } else {
      // 認証失敗
      session.destroy();
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
});
