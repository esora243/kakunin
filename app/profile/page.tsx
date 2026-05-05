"use client";



import { useState } from "react";

import { User, GraduationCap, Building2, Save, Loader2, ChevronDown } from "lucide-react";

// ※必要に応じて authやsupabaseのフックをインポートしてください



// --- 選択肢の定義 ---

const UNIVERSITIES = [

  "山口大学",

  "浜松医科大学",

];



const GRADES = [1, 2, 3, 4, 5, 6];



export default function ProfileEditPage() {

  const [isSaving, setIsSaving] = useState(false);

 

  // プロフィールの状態（初期値は仮のものです。実際はDBから取得した値をセットしてください）

  const [profile, setProfile] = useState({

    name: "医学 太郎",

    university: "山口大学",

    faculty: "医学部", // 選択肢を増やさない場合は固定でも可

    grade: 3,

  });



  const handleSave = async (e: React.FormEvent) => {

    e.preventDefault();

    setIsSaving(true);

   

    try {

      // --- ここにSupabaseへの保存処理を記述 ---

      // 例: await supabaseRestFetch({ path: 'users?id=eq.YOUR_ID', method: 'PATCH', body: profile });

     

      // 疑似的なローディング遅延（テスト用）

      await new Promise(resolve => setTimeout(resolve, 1000));

      alert("プロフィールを更新しました。");

    } catch (error) {

      console.error("保存エラー:", error);

      alert("エラーが発生しました。");

    } finally {

      setIsSaving(false);

    }

  };



  return (

    <div className="w-full max-w-2xl mx-auto bg-white min-h-screen p-6 font-sans">

      <div className="mb-8">

        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">

          <User className="text-orange-500" /> プロフィール設定

        </h1>

        <p className="text-sm text-gray-500 mt-1">あなたの所属情報を正確に登録してください。この情報をもとに時間割が表示されます。</p>

      </div>



      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

       

        {/* 名前入力 (テキスト) */}

        <div>

          <label className="block text-sm font-bold text-gray-700 mb-2">お名前</label>

          <input

            type="text"

            required

            value={profile.name}

            onChange={(e) => setProfile({...profile, name: e.target.value})}

            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-800 font-medium"

            placeholder="山田 太郎"

          />

        </div>



        {/* 大学選択 (セレクトボックス) */}

        <div>

          <label className="block text-sm font-bold text-gray-700 mb-2">大学名 <span className="text-orange-500 text-xs font-normal">※必須</span></label>

          <div className="relative">

            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">

              <Building2 className="h-5 w-5 text-gray-400" />

            </div>

            <select

              required

              value={profile.university}

              onChange={(e) => setProfile({...profile, university: e.target.value})}

              className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-800 font-bold"

            >

              <option value="" disabled>選択してください</option>

              {UNIVERSITIES.map(uni => (

                <option key={uni} value={uni}>{uni}</option>

              ))}

            </select>

            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">

              <ChevronDown size={16} />

            </div>

          </div>

        </div>



        {/* 学年選択 (セレクトボックス) */}

        <div>

          <label className="block text-sm font-bold text-gray-700 mb-2">学年 <span className="text-orange-500 text-xs font-normal">※必須</span></label>

          <div className="relative">

            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">

              <GraduationCap className="h-5 w-5 text-gray-400" />

            </div>

            <select

              required

              value={profile.grade}

              onChange={(e) => setProfile({...profile, grade: parseInt(e.target.value)})}

              className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-gray-800 font-bold"

            >

              <option value="" disabled>選択してください</option>

              {GRADES.map(g => (

                <option key={g} value={g}>{g}年生</option>

              ))}

            </select>

            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">

              <ChevronDown size={16} />

            </div>

          </div>

        </div>



        {/* 保存ボタン */}

        <button

          type="submit"

          disabled={isSaving}

          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3.5 rounded-xl transition-colors mt-8 shadow-sm"

        >

          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}

          {isSaving ? "保存中..." : "プロフィールを保存"}

        </button>



      </form>

    </div>

  );

}