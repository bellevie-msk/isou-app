'use client';
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Vehicle {
  id: number;
  name: string;
  color: string;
  type: 'ケアライフ' | 'ベルビー';
  unitPrice: number; // Add unitPrice property
}

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

export default function AdminPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allRecords, setAllRecords] = useState<MileageRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MileageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all'); // 'all' for all vehicles

  const [isEditing, setIsEditing] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<MileageRecord | null>(null);

  // Report states
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 0-indexed
  const [reportYear, setReportYear] = useState(currentYear.toString());
  const [reportMonth, setReportMonth] = useState(currentMonth.toString().padStart(2, '0'));
  const [vehicleSummary, setVehicleSummary] = useState<Record<string, { totalDistance: number; latestEndMeter: number | null }>>({});
  const [privateRecords, setPrivateRecords] = useState<MileageRecord[]>([]);
  const [companyRecords, setCompanyRecords] = useState<MileageRecord[]>([]);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- New: Fetch authentication status on load ---
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/status');
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.isAuthenticated);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);
  // --- End New ---

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        alert('パスワードが違います。');
        setPassword('');
      }
    } catch (error) {
      console.error('Authentication request failed:', error);
      alert('認証リクエスト中にエラーが発生しました。');
    }
  };

  // --- New: Logout function ---
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout');
      if (response.ok) {
        setIsAuthenticated(false);
        alert('ログアウトしました。');
      } else {
        alert('ログアウトに失敗しました。');
      }
    } catch (error) {
      console.error('Logout request failed:', error);
      alert('ログアウト中にエラーが発生しました。');
    }
  };
  // --- End New ---

  // Helper to format numbers with commas
  const formatNumberWithCommas = (num: number | string) => {
    if (num === '' || num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  useEffect(() => {
    let isMounted = true; // コンポーネントがマウントされているか追跡

    const fetchAllRecords = async () => {
      try {
        const response = await fetch('/api/mileage');
        if (response.ok) {
          const data: MileageRecord[] = await response.json();
          // 日付の新しい順にソート
          const sortedData = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          if (isMounted) {
            setAllRecords(sortedData);
          }
        } else {
          if (isMounted) {
            setError('走行記録の取得に失敗しました。');
          }
        }
      } catch (err) {
        console.error('Error fetching all records:', err);
        if (isMounted) {
          setError('走行記録の取得中にエラーが発生しました。');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const fetchVehicles = async () => {
      try {
        const response = await fetch('/api/vehicles');
        if (response.ok) {
          const data: Vehicle[] = await response.json();
          if (isMounted) {
            setVehicles(data);
          }
        } else {
          if (isMounted) {
            setError('車両データの取得に失敗しました。');
          }
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        if (isMounted) {
          setError('車両データの取得中にエラーが発生しました。');
        }
      }
    };

    fetchVehicles();
    fetchAllRecords();

    return () => {
      isMounted = false; // クリーンアップ時にマウント状態をfalseに設定
    };
  }, []); // Removed dependencies to avoid re-fetching on every render, will rely on explicit calls

  // フィルタリングロジック
  useEffect(() => {
    if (selectedVehicleId === 'all') {
      setFilteredRecords(allRecords);
    } else {
      setFilteredRecords(allRecords.filter(record => record.vehicleId === Number(selectedVehicleId)));
    }
  }, [selectedVehicleId, allRecords]);

  // Report generation logic
  useEffect(() => {
    const generateReports = () => {
      const filteredByDate = allRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === Number(reportYear) &&
               (reportMonth === 'all' || (recordDate.getMonth() + 1).toString().padStart(2, '0') === reportMonth);
      });

      const vehicleSummaryData: Record<string, { totalDistance: number; latestEndMeter: number | null }> = {};
      const allPrivateRecords: MileageRecord[] = [];
      const allCompanyRecords: MileageRecord[] = [];

      // 各車両の最新の記録を追跡するためのマップ
      const latestRecordPerVehicle: Record<number, MileageRecord> = {};

      filteredByDate.forEach(record => {
        const vehicle = vehicles.find(v => v.id === record.vehicleId);
        const vehicleName = vehicle ? `${vehicle.id}: ${vehicle.name}` : `不明な車両 (${record.vehicleId})`;
        
        // 車両別集計
        if (!vehicleSummaryData[vehicleName]) {
          vehicleSummaryData[vehicleName] = { totalDistance: 0, latestEndMeter: null };
        }
        vehicleSummaryData[vehicleName].totalDistance += (record.drivenDistance || 0);

        // 最新の記録を更新
        if (!latestRecordPerVehicle[record.vehicleId] || new Date(record.timestamp) > new Date(latestRecordPerVehicle[record.vehicleId].timestamp)) {
          latestRecordPerVehicle[record.vehicleId] = record;
        }

        // 私用分の記録を収集
        if (record.usage === '私用') {
          allPrivateRecords.push(record);
        }

        // 社用分の記録を収集
        if (record.usage === '社用') {
          allCompanyRecords.push(record);
        }
      });

      // 各車両の最終メーター値を設定
      for (const vehicleId in latestRecordPerVehicle) {
        const record = latestRecordPerVehicle[vehicleId];
        const vehicleName = getVehicleName(record.vehicleId);
        if (vehicleSummaryData[vehicleName]) {
          vehicleSummaryData[vehicleName].latestEndMeter = record.endMeter;
        }
      }

      setVehicleSummary(vehicleSummaryData);
      // Sort private records by driverName
      allPrivateRecords.sort((a, b) => a.driverName.localeCompare(b.driverName));
      setPrivateRecords(allPrivateRecords);
      // Sort company records by driverName
      allCompanyRecords.sort((a, b) => a.driverName.localeCompare(b.driverName));
      setCompanyRecords(allCompanyRecords);
    };

    generateReports();
  }, [allRecords, reportYear, reportMonth, vehicles]);

  const handleVehicleChange = (index: number, field: 'id' | 'name' | 'color' | 'type' | 'unitPrice', value: string) => {
    const newVehicles = [...vehicles];
    if (field === 'id') {
      const newId = parseInt(value, 10);
      if (!isNaN(newId)) {
        newVehicles[index] = { ...newVehicles[index], id: newId };
      }
    } else if (field === 'name') {
      newVehicles[index] = { ...newVehicles[index], name: value };
    } else if (field === 'color') {
      newVehicles[index] = { ...newVehicles[index], color: value };
    } else if (field === 'type') {
      newVehicles[index] = { ...newVehicles[index], type: value as 'ケアライフ' | 'ベルビー' };
    } else if (field === 'unitPrice') {
      const newUnitPrice = parseFloat(value);
      if (!isNaN(newUnitPrice)) {
        newVehicles[index] = { ...newVehicles[index], unitPrice: newUnitPrice };
      }
    }
    setVehicles(newVehicles);
  };

  const handleAddVehicle = () => {
    const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;
    setVehicles([...vehicles, { id: newId, name: `新しい車両 ${newId}`, color: 'blue', type: 'ベルビー', unitPrice: 0 }]);
  };

  const handleDeleteVehicle = (index: number) => {
    if (confirm('この車両を本当に削除しますか？関連する走行記録は残りますが、車両名が表示されなくなります。')) {
      const newVehicles = vehicles.filter((_, i) => i !== index);
      setVehicles(newVehicles);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicles),
      });

      if (response.ok) {
        alert('車両名を更新しました。');
      } else {
        alert('車両名の更新に失敗しました。');
      }
    } catch (err) {
      console.error('Error saving vehicle names:', err);
      alert('車両名の更新中にエラーが発生しました。');
    }
  };

  const getVehicleName = (vehicleId: number) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.id}: ${vehicle.name}` : `不明な車両 (${vehicleId})`;
  };

  const getYears = () => {
    const years = new Set<number>();
    allRecords.forEach(record => years.add(new Date(record.date).getFullYear()));
    if (years.size === 0) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  };

  const getMonths = () => {
    return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  };

  const handleEdit = (record: MileageRecord) => {
    setCurrentRecord(record);
    setIsEditing(true);
  };

  const handleDelete = async (timestamp: string) => {
    if (confirm('この記録を本当に削除しますか？')) {
      try {
        const response = await fetch('/api/mileage', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timestamp }),
        });

        if (response.ok) {
          alert('記録を削除しました。');
          setAllRecords(prevRecords => prevRecords.filter(record => record.timestamp !== timestamp));
        } else {
          alert('削除に失敗しました。');
        }
      } catch (err) {
        console.error('Error deleting record:', err);
        alert('削除中にエラーが発生しました。');
      }
    }
  };

  const handleSaveEdit = async (updatedRecord: MileageRecord) => {
    try {
      const response = await fetch('/api/mileage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
      });

      if (response.ok) {
        alert('記録を更新しました。');
        setIsEditing(false);
        setCurrentRecord(null);
        setAllRecords(prevRecords => prevRecords.map(record => record.timestamp === updatedRecord.timestamp ? updatedRecord : record));
      } else {
        alert('更新に失敗しました。');
      }
    } catch (err) {
      console.error('Error updating record:', err);
      alert('更新中にエラーが発生しました。');
    }
  };

  // Helper to get day of week (for edit modal)
  const getDayOfWeek = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[d.getDay()];
  };

  if (loading) {
    return <main className="container mx-auto p-4 text-center">読み込み中...</main>;
  }

  if (error) {
    return <main className="container mx-auto p-4 text-center text-red-500">エラー: {error}</main>;
  }

  if (!isAuthenticated) {
    return (
      <main className="container mx-auto p-4 flex justify-center items-center h-screen">
        <form onSubmit={handlePasswordSubmit} className="bg-white p-8 rounded shadow-md">
          <h1 className="text-2xl font-bold mb-4 text-black">管理者ページ</h1>
          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">パスワード:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            ログイン
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4">
      {/* --- New: Logout Button --- */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          ログアウト
        </button>
      </div>
      {/* --- End New --- */}

      {/* 集計レポートセクション */}
      <h2 className="text-2xl font-bold mb-4 mt-8 text-center">走行距離集計レポート</h2>
      <div className="mb-4 flex justify-center items-center gap-4">
        <label htmlFor="reportYear">年:</label>
        <select
          id="reportYear"
          className="p-2 border border-gray-300 rounded text-black"
          value={reportYear}
          onChange={(e) => setReportYear(e.target.value)}
        >
          {getYears().map(year => (
            <option key={year} value={year}>{year}年</option>
          ))}
        </select>
        <label htmlFor="reportMonth">月:</label>
        <select
          id="reportMonth"
          className="p-2 border border-gray-300 rounded w-full text-black"
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
        >
          <option value="all">全期間</option>
          {getMonths().map(month => (
            <option key={month} value={month}>{Number(month)}月</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-8 mt-8">
        <div>
          <h3 className="text-xl font-bold mb-2">車両別集計 (km)</h3>
          {Object.keys(vehicleSummary).length === 0 ? (
            <p>データがありません。</p>
          ) : (
            <table className="min-w-full bg-white border border-gray-700 text-black">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">車両名</th>
                  <th className="py-2 px-4 border-b">総走行距離</th>
                  <th className="py-2 px-4 border-b">最終メーター値</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(vehicleSummary).map(([name, data]) => (
                  <tr key={name} className="bg-white">
                    <td className="py-2 px-4 border-b">{name}</td>
                    <td className="py-2 px-4 border-b">{data.totalDistance.toFixed(1)}</td>
                    <td className="py-2 px-4 border-b">{data.latestEndMeter !== null ? formatNumberWithCommas(data.latestEndMeter) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4 mt-8 text-center">私用走行集計レポート</h2>
      {privateRecords.length === 0 ? (
        <p className="text-center">私用走行の記録はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-700 text-black">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">運転手</th>
                <th className="py-2 px-4 border-b">車両名</th>
                <th className="py-2 px-4 border-b">月日</th>
                <th className="py-2 px-4 border-b">曜日</th>
                <th className="py-2 px-4 border-b">用途</th>
                <th className="py-2 px-4 border-b">距離(km)</th>
                <th className="py-2 px-4 border-b">単価(円/km)</th>
                <th className="py-2 px-4 border-b">料金(円)</th>
              </tr>
            </thead>
            <tbody>
              {privateRecords.map((record, recordIndex) => {
                const vehicle = vehicles.find(v => v.id === record.vehicleId);
                const unitPrice = vehicle ? vehicle.unitPrice : 0;
                const amount = (record.drivenDistance || 0) * unitPrice;
                return (
                  <tr key={recordIndex} className={recordIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b">{record.driverName}</td>
                    <td className="py-2 px-4 border-b">{getVehicleName(record.vehicleId)}</td>
                    <td className="py-2 px-4 border-b">{record.date?.substring(5) || ''}</td>
                    <td className="py-2 px-4 border-b">{record.dayOfWeek || ''}</td>
                    <td className="py-2 px-4 border-b">{record.usage || ''}</td>
                    <td className="py-2 px-4 border-b">{record.type || ''}</td>
                    <td className="py-2 px-4 border-b">{record.drivenDistance || ''}</td>
                    <td className="py-2 px-4 border-b">{unitPrice}</td>
                    <td className="py-2 px-4 border-b">{amount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4 mt-8 text-center">社用走行集計レポート</h2>
      {companyRecords.length === 0 ? (
        <p className="text-center">社用走行の記録はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-700 text-black">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">運転手</th>
                <th className="py-2 px-4 border-b">車両名</th>
                <th className="py-2 px-4 border-b">月日</th>
                <th className="py-2 px-4 border-b">曜日</th>
                <th className="py-2 px-4 border-b">用途</th>
                <th className="py-2 px-4 border-b">種類</th>
                <th className="py-2 px-4 border-b">距離(km)</th>
                <th className="py-2 px-4 border-b">単価(円/km)</th>
                <th className="py-2 px-4 border-b">料金(円)</th>
              </tr>
            </thead>
            <tbody>
              {companyRecords.map((record, recordIndex) => {
                const vehicle = vehicles.find(v => v.id === record.vehicleId);
                const unitPrice = vehicle ? vehicle.unitPrice : 0;
                const amount = (record.drivenDistance || 0) * unitPrice;
                return (
                  <tr key={recordIndex} className={recordIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b">{record.driverName}</td>
                    <td className="py-2 px-4 border-b">{getVehicleName(record.vehicleId)}</td>
                    <td className="py-2 px-4 border-b">{record.date?.substring(5) || ''}</td>
                    <td className="py-2 px-4 border-b">{record.dayOfWeek || ''}</td>
                    <td className="py-2 px-4 border-b">{record.usage || ''}</td>
                    <td className="py-2 px-4 border-b">{record.type || ''}</td>
                    <td className="py-2 px-4 border-b">{record.drivenDistance || ''}</td>
                    <td className="py-2 px-4 border-b">{unitPrice}</td>
                    <td className="py-2 px-4 border-b">{amount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4 mt-8 text-center">全走行記録</h1>

      {filteredRecords.length === 0 ? (
        <p className="text-center">まだ記録がありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-700 text-black">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">車両名</th>
                <th className="py-2 px-4 border-b">月日</th>
                <th className="py-2 px-4 border-b">曜日</th>
                <th className="py-2 px-4 border-b">運転手</th>
                <th className="py-2 px-4 border-b">用途</th>
                <th className="py-2 px-4 border-b">種類</th>
                <th className="py-2 px-4 border-b">乗車時M</th>
                <th className="py-2 px-4 border-b">出庫時間</th>
                <th className="py-2 px-4 border-b">終了時M</th>
                <th className="py-2 px-4 border-b">帰庫時間</th>
                <th className="py-2 px-4 border-b">距離(km)</th>
                <th className="py-2 px-4 border-b">時間</th>
                <th className="py-2 px-4 border-b">備考</th>
                <th className="py-2 px-4 border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-4 border-b">{getVehicleName(record.vehicleId)}</td>
                  <td className="py-2 px-4 border-b">{record.date?.substring(5) || ''}</td>
                  <td className="py-2 px-4 border-b">{record.dayOfWeek || ''}</td>
                  <td className="py-2 px-4 border-b">{record.driverName || ''}</td>
                  <td className="py-2 px-4 border-b">{record.usage || ''}</td>
                  <td className="py-2 px-4 border-b">{record.type || ''}</td>
                  <td className="py-2 px-4 border-b">{formatNumberWithCommas(record.startMeter)}</td>
                  <td className="py-2 px-4 border-b">{record.startTime || ''}</td>
                  <td className="py-2 px-4 border-b">{formatNumberWithCommas(record.endMeter)}</td>
                  <td className="py-2 px-4 border-b">{record.endTime || ''}</td>
                  <td className="py-2 px-4 border-b">{record.drivenDistance || ''}</td>
                  <td className="py-2 px-4 border-b">{record.drivenTime || ''}</td>
                  <td className="py-2 px-4 border-b">{record.notes || ''}</td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => handleEdit(record)}
                      className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded text-sm mr-2"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(record.timestamp)}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4 text-center">車両情報編集</h2>
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 text-right">
            <button
              onClick={handleAddVehicle}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              車両を追加
            </button>
          </div>
          <table className="min-w-full bg-white border border-gray-300 text-black mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b text-left w-24">車両番号</th>
                <th className="py-2 px-4 border-b text-left">車両名</th>
                <th className="py-2 px-4 border-b text-left w-32">色</th>
                <th className="py-2 px-4 border-b text-left w-32">種類</th>
                <th className="py-2 px-4 border-b text-left w-24">単価</th>
                <th className="py-2 px-4 border-b text-center w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, index) => (
                <tr key={index}>
                  <td className="py-2 px-4 border-b w-24">
                    <input
                      type="number"
                      value={vehicle.id}
                      onChange={(e) => handleVehicleChange(index, 'id', e.target.value)}
                      className="p-2 border border-gray-300 rounded w-full text-black"
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <input
                      type="text"
                      value={vehicle.name}
                      onChange={(e) => handleVehicleChange(index, 'name', e.target.value)}
                      className="p-2 border border-gray-300 rounded w-full text-black"
                    />
                  </td>
                  <td className="py-2 px-4 border-b w-32">
                    <select
                      value={vehicle.color}
                      onChange={(e) => handleVehicleChange(index, 'color', e.target.value)}
                      className="p-2 border border-gray-300 rounded w-full text-black"
                    >
                      <option value="blue">青</option>
                      <option value="green">緑</option>
                    </select>
                  </td>
                  <td className="py-2 px-4 border-b w-32">
                    <select
                      value={vehicle.type}
                      onChange={(e) => handleVehicleChange(index, 'type', e.target.value)}
                      className="p-2 border border-gray-300 rounded w-full text-black"
                    >
                      <option value="ベルビー">ベルビー</option>
                      <option value="ケアライフ">ケアライフ</option>
                    </select>
                  </td>
                  <td className="py-2 px-4 border-b w-24">
                    <input
                      type="number"
                      value={vehicle.unitPrice}
                      onChange={(e) => handleVehicleChange(index, 'unitPrice', e.target.value)}
                      className="p-2 border border-gray-300 rounded w-full text-black"
                    />
                  </td>
                  <td className="py-2 px-4 border-b text-center w-24">
                    <button
                      onClick={() => handleDeleteVehicle(index)}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center">
            <button
              onClick={handleSaveChanges}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-lg"
            >
              すべての変更を保存
            </button>
          </div>
        </div>
      </div>

      {/* 編集モーダル */}
      {isEditing && currentRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-3xl w-full text-black">
            <h2 className="text-xl font-bold mb-4">記録を編集</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit(currentRecord);
            }} className="flex flex-col gap-4">
              {/* 編集フォームの各フィールド */}
              <div>
                <label htmlFor="editDate" className="text-lg">月日曜日:</label>
                <input
                  type="date"
                  id="editDate"
                  name="date"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.date}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, date: e.target.value, dayOfWeek: getDayOfWeek(e.target.value) })}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">({getDayOfWeek(currentRecord.date)}曜日)</p>
              </div>
              <div>
                <label htmlFor="editDriverName" className="text-lg">運転手氏名:</label>
                <input
                  type="text"
                  id="editDriverName"
                  name="driverName"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.driverName}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, driverName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="editUsage" className="text-lg">用途:</label>
                <select
                  id="editUsage"
                  name="usage"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.usage}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, usage: e.target.value as '勤務' | '社用' | '私用' })}
                  required
                >
                  <option value="勤務">勤務</option>
                  <option value="社用">社用</option>
                  <option value="私用">私用</option>
                </select>
              </div>
              <div>
                <label htmlFor="editType" className="text-lg">種類:</label>
                <select
                  id="editType"
                  name="type"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.type}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, type: e.target.value as 'ケアライフ' | 'ベルビー' })}
                  required
                >
                  <option value="ベルビー">ベルビー</option>
                  <option value="ケアライフ">ケアライフ</option>
                </select>
              </div>
              <div>
                <label htmlFor="editStartMeter" className="text-lg">乗車時メーター:</label>
                <input
                  type="number"
                  id="editStartMeter"
                  name="startMeter"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.startMeter}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, startMeter: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label htmlFor="editStartTime" className="text-lg">出庫時間:</label>
                <input
                  type="time"
                  id="editStartTime"
                  name="startTime"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.startTime}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="editEndMeter" className="text-lg">終了時メーター:</label>
                <input
                  type="number"
                  id="editEndMeter"
                  name="endMeter"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  value={currentRecord.endMeter}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, endMeter: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label htmlFor="editDrivenDistance" className="text-lg">距離 (km):</label>
                <input
                  type="number"
                  id="editDrivenDistance"
                  name="drivenDistance"
                  className="p-2 border border-gray-300 rounded w-full text-black bg-gray-100"
                  value={currentRecord.drivenDistance}
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="editDrivenTime" className="text-lg">時間 (HH:MM):</label>
                <input
                  type="text"
                  id="editDrivenTime"
                  name="drivenTime"
                  className="p-2 border border-gray-300 rounded w-full text-black"
                  value={currentRecord.drivenTime}
                  readOnly
                />
              </div>
              <div className="col-span-full">
                <label htmlFor="editNotes" className="text-lg">備考欄:</label>
                <textarea
                  id="editNotes"
                  name="notes"
                  className="p-2 border border-gray-700 rounded w-full text-black"
                  rows={3}
                  value={currentRecord.notes}
                  onChange={(e) => setCurrentRecord({ ...currentRecord, notes: e.target.value })}
                ></textarea>
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}