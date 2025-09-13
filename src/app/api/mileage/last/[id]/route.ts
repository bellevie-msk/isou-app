import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const mileageRecordsPath = path.join(process.cwd(), 'src/data/mileage_records.json');

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const vehicleId = Number(params.id);

    if (isNaN(vehicleId)) {
      return NextResponse.json({ message: 'Invalid vehicle ID' }, { status: 400 });
    }

    let records = [];
    if (fs.existsSync(mileageRecordsPath)) {
      const data = fs.readFileSync(mileageRecordsPath, 'utf-8');
      records = JSON.parse(data);
    }

    // Filter records for the specific vehicle and sort by timestamp to get the latest
    const vehicleRecords = records
      .filter((record: any) => record.vehicleId === vehicleId)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (vehicleRecords.length > 0) {
      const lastRecord = vehicleRecords[0];
      return NextResponse.json({
        lastEndMeter: lastRecord.endMeter,
        lastDriverName: lastRecord.driverName,
        lastStartTime: lastRecord.startTime,
      }, { status: 200 });
    } else {
      return NextResponse.json({ lastEndMeter: null, lastDriverName: null, lastStartTime: null }, { status: 200 }); // No previous record
    }
  } catch (error) {
    console.error('Error fetching last mileage record:', error);
    return NextResponse.json({ message: 'Failed to fetch last mileage' }, { status: 500 });
  }
}
