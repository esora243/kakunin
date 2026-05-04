"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Briefcase, MapPin, Search, Loader2, ChevronRight, DollarSign } from "lucide-react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      try {
        const data = await supabaseRestFetch<any[]>({ path: "jobs?select=*" });
        setJobs(data || []);
      } catch (error) {
        console.error("求人データの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchQuery.toLowerCase();
      return (
        job.title?.toLowerCase().includes(query) ||
        job.company_name?.toLowerCase().includes(query) ||
        job.location_pref?.toLowerCase().includes(query)
      );
    });
  }, [jobs, searchQuery]);

  return (
    <div className="w-full max-w-lg mx-auto pb-20 bg-white min-h-screen animate-fade-in">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">キャリア・求人</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="職種・キーワードで検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
          />
        </div>
      </div>

      <div className="px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
            <p className="text-gray-500 font-bold">求人情報を読み込み中...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-10 text-center border border-dashed border-gray-200">
            <Briefcase className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-500 font-bold">該当する求人が見つかりませんでした</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mb-2 inline-block">
                      {job.company_name}
                    </span>
                    <h3 className="font-bold text-gray-800 text-lg leading-tight group-hover:text-orange-600 transition-colors">
                      {job.title}
                    </h3>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin size={14} className="text-orange-400" />
                    <span>{job.location_pref}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <DollarSign size={14} className="text-orange-400" />
                    <span className="font-bold text-gray-700">{job.salary_display}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}