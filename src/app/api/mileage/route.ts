import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { withSession } from '@/lib/session';
import { IronSession } from 'iron-session';

const dataFilePath = path.join(process.cwd(), 'src', 'data', 'mileage_records.json');

// Helper function to read records from the JSON file
async function getRecords() {
  try {
    const fileContents = await fs.readFile(dataFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    // If the file doesn't exist or is empty, return an empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Get all records (Public)
export async function GET() {
  try {
    const records = await getRecords();
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error reading mileage records:', error);
    return NextResponse.json({ message: '記録の取得に失敗しました' }, { status: 500 });
  }
}

// Add a new record (Protected)
export const POST = withSession(async (session: IronSession, request: Request) => {
  if (!session.isAuthenticated) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const newRecord = await request.json();
    const records = await getRecords();
    records.push(newRecord);
    await fs.writeFile(dataFilePath, JSON.stringify(records, null, 2), 'utf8');
    return NextResponse.json({ message: '走行距離を記録しました' });
  } catch (error) {
    console.error('Error saving mileage record:', error);
    return NextResponse.json({ message: '記録に失敗しました' }, { status: 500 });
  }
});

// Update a record (Protected)
export const PUT = withSession(async (session: IronSession, request: Request) => {
  if (!session.isAuthenticated) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const updatedRecord = await request.json();
    const records = await getRecords();
    const index = records.findIndex((record: any) => record.timestamp === updatedRecord.timestamp);

    if (index !== -1) {
      records[index] = updatedRecord;
      await fs.writeFile(dataFilePath, JSON.stringify(records, null, 2), 'utf8');
      return NextResponse.json({ message: '記録を更新しました' });
    } else {
      return NextResponse.json({ message: '記録が見つかりません' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating mileage record:', error);
    return NextResponse.json({ message: '記録の更新に失敗しました' }, { status: 500 });
  }
});

// Delete a record (Protected)
export const DELETE = withSession(async (session: IronSession, request: Request) => {
  if (!session.isAuthenticated) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { timestamp } = await request.json();
    const records = await getRecords();
    const initialLength = records.length;
    const filteredRecords = records.filter((record: any) => record.timestamp !== timestamp);

    if (filteredRecords.length < initialLength) {
      await fs.writeFile(dataFilePath, JSON.stringify(filteredRecords, null, 2), 'utf8');
      return NextResponse.json({ message: '記録を削除しました' });
    } else {
      return NextResponse.json({ message: '記録が見つかりません' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error deleting mileage record:', error);
    return NextResponse.json({ message: '記録の削除に失敗しました' }, { status: 500 });
  }
});
