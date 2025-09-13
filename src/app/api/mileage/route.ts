import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const mileageRecordsPath = path.join(process.cwd(), 'src/data/mileage_records.json');

export async function POST(request: Request) {
  try {
    const { vehicleId, date, dayOfWeek, driverName, usage, type, startMeter, startTime, endMeter, endTime, drivenDistance, drivenTime, notes, timestamp } = await request.json();

    let records = [];
    if (fs.existsSync(mileageRecordsPath)) {
      const data = fs.readFileSync(mileageRecordsPath, 'utf-8');
      records = JSON.parse(data);
    }

    records.push({
      vehicleId,
      date,
      dayOfWeek,
      driverName,
      usage,
      type,
      startMeter,
      startTime,
      endMeter,
      endTime,
      drivenDistance,
      drivenTime,
      notes,
      timestamp,
    });

    fs.writeFileSync(mileageRecordsPath, JSON.stringify(records, null, 2));

    return NextResponse.json({ message: '走行距離を記録しました' }, { status: 200 });
  } catch (error) {
    console.error('Error saving mileage record:', error);
    return NextResponse.json({ message: '記録に失敗しました' }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (fs.existsSync(mileageRecordsPath)) {
      const data = fs.readFileSync(mileageRecordsPath, 'utf-8');
      const records = JSON.parse(data);
      return NextResponse.json(records, { status: 200 });
    } else {
      return NextResponse.json([], { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching mileage records:', error);
    return NextResponse.json({ message: '記録の取得に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const updatedRecord = await request.json();
    let records = [];
    if (fs.existsSync(mileageRecordsPath)) {
      const data = fs.readFileSync(mileageRecordsPath, 'utf-8');
      records = JSON.parse(data);
    }

    const index = records.findIndex((record: any) => record.timestamp === updatedRecord.timestamp);
    if (index !== -1) {
      records[index] = updatedRecord;
      fs.writeFileSync(mileageRecordsPath, JSON.stringify(records, null, 2));
      return NextResponse.json({ message: '記録を更新しました' }, { status: 200 });
    } else {
      return NextResponse.json({ message: '記録が見つかりません' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating mileage record:', error);
    return NextResponse.json({ message: '記録の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { timestamp } = await request.json();
    let records = [];
    if (fs.existsSync(mileageRecordsPath)) {
      const data = fs.readFileSync(mileageRecordsPath, 'utf-8');
      records = JSON.parse(data);
    }

    const initialLength = records.length;
    const filteredRecords = records.filter((record: any) => record.timestamp !== timestamp);

    if (filteredRecords.length < initialLength) {
      fs.writeFileSync(mileageRecordsPath, JSON.stringify(filteredRecords, null, 2));
      return NextResponse.json({ message: '記録を削除しました' }, { status: 200 });
    } else {
      return NextResponse.json({ message: '記録が見つかりません' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error deleting mileage record:', error);
    return NextResponse.json({ message: '記録の削除に失敗しました' }, { status: 500 });
  }
}
