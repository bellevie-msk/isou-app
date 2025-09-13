'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Linkコンポーネントをインポート
import vehicles from '@/data/vehicles.json';

// 新しいデータ構造の型定義
interface MileageRecord {
  vehicleId: number;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 曜日
  driverName: string;
  usage: '勤務' | '社用' | '私用';
  type: 'ケアライフ' | 'ベルビー';
  startMeter: number;
  startTime: string; // HH:MM
  endMeter: number;
  endTime: string; // HH:MM
  drivenDistance: number;
  drivenTime: string; // HH:MM or minutes
  notes: string;
  timestamp: string; // ISO string
}

export default function VehicleDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const vehicle = vehicles.find(v => v.id === Number(id));

  // State for form inputs
  const [date, setDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [driverName, setDriverName] = useState('');
  const [usage, setUsage] = useState<'勤務' | '社用' | '私用'>('勤務');
  const [type, setType] = useState<'ケアライフ' | 'ベルビー'>('ケアライフ');
  const [startMeter, setStartMeter] = useState<number | string>('');
  const [startTime, setStartTime] = useState('');
  const [endMeter, setEndMeter] = useState<number | string>('');
  const [endTime, setEndTime] = useState('');
  const [drivenDistance, setDrivenDistance] = useState<number | string>(''); // 自動計算
  const [drivenTime, setDrivenTime] = useState(''); // 自動計算
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Helper to format numbers with commas
  const formatNumberWithCommas = (num: number | string) => {
    if (num === '' || num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // State for monthly records display
  const [monthlyRecords, setMonthlyRecords] = useState<MileageRecord[]>([]);

  // Helper to get day of week
  const getDayOfWeek = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[d.getDay()];
  };

  // Effect to set initial date and day of week
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayString = `${yyyy}-${mm}-${dd}`;
    setDate(todayString);
    setDayOfWeek(getDayOfWeek(todayString));
  }, []);

  // Effect to update day of week when date changes
  useEffect(() => {
    setDayOfWeek(getDayOfWeek(date));
  }, [date]);

  // Effect to calculate drivenDistance
  useEffect(() => {
    if (typeof startMeter === 'number' && typeof endMeter === 'number' && endMeter >= startMeter) {
      setDrivenDistance(endMeter - startMeter);
    } else {
      setDrivenDistance('');
    }
  }, [startMeter, endMeter]);

  // Effect to calculate drivenTime (in minutes)
  useEffect(() => {
    if (startTime && endTime) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const totalStartMinutes = startHour * 60 + startMinute;
      const totalEndMinutes = endHour * 60 + endMinute;

      let diffMinutes = totalEndMinutes - totalStartMinutes;

      // 日付をまたがない場合（例: 23:00 -> 01:00）
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60; // 24時間を分に変換して加算
      }

      setDrivenTime(diffMinutes.toString()); // 分単位の数値を文字列として保存
    } else {
      setDrivenTime('');
    }
  }, [startTime, endTime]);


  // 最新の終了時メーター値、運転手名、出庫時間を取得する関数
  const fetchLastRecordData = async () => {
    if (!vehicle) return;
    try {
      const response = await fetch(`/api/mileage/last/${vehicle.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.lastEndMeter !== null) {
          setStartMeter(data.lastEndMeter);
        }
        if (data.lastDriverName !== null) {
          setDriverName(data.lastDriverName);
        }
        if (data.lastStartTime !== null) {
          setStartTime(data.lastStartTime);
        }
      }
    } catch (error) {
      console.error('Error fetching last record data:', error);
    }
  };

  // 月間履歴を取得する関数
  const fetchMonthlyRecords = async () => {
    if (!vehicle) return;
    try {
      const response = await fetch('/api/mileage');
      if (response.ok) {
        const allRecords: MileageRecord[] = await response.json();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const filteredRecords = allRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear && record.vehicleId === vehicle.id;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMonthlyRecords(filteredRecords);
      }
    } catch (error) {
      console.error('Error fetching monthly records:', error);
    }
  };

  // コンポーネントロード時に最新の終了時メーター値と月間履歴を取得
  useEffect(() => {
    fetchLastRecordData();
    fetchMonthlyRecords();
  }, [vehicle]);

  if (!vehicle) {
    return <p>車両が見つかりません。</p>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (typeof startMeter !== 'number' || typeof endMeter !== 'number') {
      setMessage('メーター値は数値で入力してください。');
      return;
    }

    if (endMeter < startMeter) {
      setMessage('終了時メーターは乗車時メーターより大きい値を入力してください。');
      return;
    }

    if (!driverName.trim() || !date.trim() || !startTime.trim() || !endTime.trim() || typeof drivenDistance !== 'number') { // drivenTimeの必須チェックを削除
      setMessage('必須項目をすべて入力してください。');
      return;
    }

    try {
      const response = await fetch('/api/mileage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId: vehicle.id,
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
          drivenTime, // 自動計算されたdrivenTimeを使用
          notes,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setMessage('走行距離を記録しました！');
        // 記録成功後、次の乗車時メーターとして現在の終了時メーターを設定
        setStartMeter(endMeter);
        // 運転手名と出庫時間はクリアしない
        setEndMeter('');
        setStartTime(startTime); // 出庫時間は保持
        setEndTime('');
        // drivenTimeは自動計算なのでクリアしない
        setNotes('');
        // 記録後、月間履歴を再取得
        fetchMonthlyRecords();
      } else {
        setMessage('記録に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Error saving mileage:', error);
      setMessage('エラーが発生しました。');
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">{vehicle.id}: {vehicle.name} の走行記録入力</h1>
      <div className="mb-4">
        <Link href="/" passHref>
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            車両選択に戻る
          </button>
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 用途 */}
          <div>
            <label htmlFor="usage" className="text-lg">用途:</label>
            <select
              id="usage"
              name="usage"
              className="p-2 border border-gray-700 rounded w-full text-black"
              value={usage}
              onChange={(e) => setUsage(e.target.value as '勤務' | '社用' | '私用')}
              required
            >
              <option value="勤務">勤務</option>
              <option value="社用">社用</option>
              <option value="私用">私用</option>
            </select>
          </div>
          {/* 種類 */}
          <div>
            <label htmlFor="type" className="text-lg">種類:</label>
            <select
              id="type"
              name="type"
              className="p-2 border border-gray-700 rounded w-full text-black"
              value={type}
              onChange={(e) => setType(e.target.value as 'ケアライフ' | 'ベルビー')}
              required
            >
              <option value="ベルビー">ベルビー</option>
              <option value="ケアライフ">ケアライフ</option>
            </select>
          </div>
          {/* 月日曜日 */}
          <div>
            <label htmlFor="date" className="text-lg">月日曜日:</label>
            <input
              type="date"
              id="date"
              name="date"
              className="p-2 border border-gray-700 rounded w-full text-black"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <p className="text-sm text-gray-500 mt-1">({dayOfWeek}曜日)</p>
          </div>
          {/* 運転手氏名 */}
          <div>
            <label htmlFor="driverName" className="text-lg">運転手氏名:</label>
            <input
              type="text"
              id="driverName"
              name="driverName"
              className="p-2 border border-gray-700 rounded w-full text-black"
              placeholder="運転手氏名を入力してください"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
          </div>
          {/* 乗車時メーター、出庫時間 */}
          <div>
            <label htmlFor="startMeter" className="text-lg">乗車時メーター:</label>
            <input
              type="number"
              id="startMeter"
              name="startMeter"
              className="p-2 border border-gray-700 rounded w-full text-black"
              placeholder="乗車時のメーター値を入力してください"
              value={startMeter}
              onChange={(e) => setStartMeter(e.target.value === '' ? '' : Number(e.target.value.replace(/,/g, '')))}
              required
            />
            <label htmlFor="startTime" className="text-lg mt-2 block">出庫時間:</label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              className="p-2 border border-gray-700 rounded w-full text-black"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          {/* 終了時メーター、帰庫時間 */}
          <div>
            <label htmlFor="endMeter" className="text-lg">終了時メーター:</label>
            <input
              type="number"
              id="endMeter"
              name="endMeter"
              className="p-2 border border-gray-700 rounded w-full text-black"
              placeholder="終了時のメーター値を入力してください"
              value={endMeter}
              onChange={(e) => setEndMeter(e.target.value === '' ? '' : Number(e.target.value.replace(/,/g, '')))}
              required
            />
            <label htmlFor="endTime" className="text-lg mt-2 block">帰庫時間:</label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              className="p-2 border border-gray-700 rounded w-full text-black"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
          {/* 距離、時間 */}
          <div>
            <label htmlFor="drivenDistance" className="text-lg">距離 (km):</label>
            <input
              type="number"
              id="drivenDistance"
              name="drivenDistance"
              className="p-2 border border-gray-300 rounded w-full text-black bg-gray-100"
              value={drivenDistance}
              readOnly
            />
            <label htmlFor="drivenTime" className="text-lg mt-2 block">時間 (分):</label>
            <input
              type="number" // 数値入力に変更
              id="drivenTime"
              name="drivenTime"
              className="p-2 border border-gray-300 rounded w-full text-black bg-gray-100"
              placeholder="例: 90"
              value={drivenTime}
              readOnly // 読み取り専用
            />
          </div>
          {/* 備考欄 */}
          <div className="md:col-span-2 lg:col-span-3"> {/* 複数列にまたがるように調整 */}
            <label htmlFor="notes" className="text-lg">備考欄:</label>
            <textarea
              id="notes"
              name="notes"
              className="p-2 border border-gray-700 rounded w-full text-black"
              rows={3}
              placeholder="備考を入力してください"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
        </div>
        <button type="submit" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          記録する
        </button>
        {message && <p className="mt-4 text-center text-red-500">{message}</p>}
      </form>

      {/* 月間記録履歴 */}
      <h2 className="text-xl font-bold mb-4 mt-8 text-center">今月の記録履歴 ({vehicle.id}: {vehicle.name})</h2>
      {monthlyRecords.length === 0 ? (
        <p className="text-center">今月の記録はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-700 text-black">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-gray-700">用途</th>
                <th className="py-2 px-4 border-b border-gray-700">種類</th>
                <th className="py-2 px-4 border-b border-gray-700">月日</th>
                <th className="py-2 px-4 border-b border-gray-700">曜日</th>
                <th className="py-2 px-4 border-b border-gray-700">運転手</th>
                <th className="py-2 px-4 border-b border-gray-700">乗車時M</th>
                <th className="py-2 px-4 border-b border-gray-700">出庫時間</th>
                <th className="py-2 px-4 border-b border-gray-700">終了時M</th>
                <th className="py-2 px-4 border-b border-gray-700">帰庫時間</th>
                <th className="py-2 px-4 border-b border-gray-700">距離(km)</th>
                <th className="py-2 px-4 border-b border-gray-700">時間(分)</th>
                <th className="py-2 px-4 border-b border-gray-700">備考</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRecords.map((record, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}><td className="py-2 px-4 border-b border-gray-700">{record.usage}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.type}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.date.substring(5)}</td> {/* MM-DD */}
                  <td className="py-2 px-4 border-b border-gray-700">{record.dayOfWeek}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.driverName}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{formatNumberWithCommas(record.startMeter)}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.startTime}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{formatNumberWithCommas(record.endMeter)}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.endTime}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.drivenDistance}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.drivenTime}分</td>
                  <td className="py-2 px-4 border-b border-gray-700">{record.notes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}