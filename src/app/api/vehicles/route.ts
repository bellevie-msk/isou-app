
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'src/data/vehicles.json');

// 車両一覧を取得
export async function GET() {
  try {
    const fileContents = await fs.readFile(dataFilePath, 'utf8');
    const vehicles = JSON.parse(fileContents);
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error reading vehicles data:', error);
    return NextResponse.json({ message: '車両データの読み込みに失敗しました。' }, { status: 500 });
  }
}

// 車両一覧を更新
export async function POST(request: Request) {
  try {
    const updatedVehicles = await request.json();
    await fs.writeFile(dataFilePath, JSON.stringify(updatedVehicles, null, 2), 'utf8');
    return NextResponse.json({ message: '車両データを更新しました。' });
  } catch (error) {
    console.error('Error writing vehicles data:', error);
    return NextResponse.json({ message: '車両データの更新に失敗しました。' }, { status: 500 });
  }
}
