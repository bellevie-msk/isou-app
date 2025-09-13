import Link from 'next/link';
import vehicles from '@/data/vehicles.json';

interface Vehicle {
  id: number;
  name: string;
  color: string;
}

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">車両一覧</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
        {(vehicles as Vehicle[]).map((vehicle) => (
          <Link key={vehicle.id} href={`/vehicle/${vehicle.id}`} passHref>
            <button className={`w-full h-24 text-white font-bold py-2 px-4 rounded flex flex-col justify-center items-center ${vehicle.color === 'blue' ? 'bg-blue-500 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-700'}`}>
              <span className="text-lg">{vehicle.id}</span>
              <span className="text-sm">{vehicle.name}</span>
            </button>
          </Link>
        ))}
      </div>
      <div className="hidden md:block mt-8 text-center">
        <Link href="/admin" passHref>
          <button className="bg-gray-600 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded">
            管理者ページへ
          </button>
        </Link>
      </div>
    </main>
  );
}