"use client";

import { motion } from "framer-motion";
import { Trophy, Sparkles, Play, Crown } from "lucide-react";

const teams = [
  { name: "GOLD", color: "text-amber-300" },
  { name: "BLUE", color: "text-blue-300" },
  { name: "PURPLE", color: "text-purple-300" },
  { name: "GREEN", color: "text-emerald-300" }
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080817] px-6 py-16 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.25),_transparent_60%)]" />
      <div className="absolute left-10 top-12 h-40 w-40 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <div className="mb-8 flex justify-center">
          <div className="rounded-full border border-amber-400/40 bg-amber-400/10 p-5">
            <Trophy className="h-12 w-12 text-amber-300" />
          </div>
        </div>

        <p className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.4em] text-amber-300">
          <Sparkles className="h-4 w-4" />
          The Indian Edition
          <Sparkles className="h-4 w-4" />
        </p>

        <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-7xl md:text-8xl">
          NEW YEAR
          <span className="block bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
            SHOWDOWN
          </span>
          <span className="mt-2 block text-3xl font-bold tracking-[0.35em] text-white sm:text-5xl">
            2027
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-slate-300 sm:text-xl">
          ONE NIGHT. FOUR TEAMS. 75 QUESTIONS. ONE CHAMPION.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-9 py-4 font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition hover:scale-105 sm:w-auto">
            <Play className="h-5 w-5" />
            Enter the Show
          </button>
          <button className="w-full rounded-xl border border-white/20 bg-white/5 px-9 py-4 font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:w-auto">
            How to Play
          </button>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {teams.map((team) => (
            <div key={team.name} className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <Crown className={`mx-auto mb-2 h-6 w-6 ${team.color}`} />
              <p className={`text-sm font-black tracking-[0.2em] ${team.color}`}>
                {team.name}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs font-medium tracking-[0.3em] text-slate-500">
          THE ULTIMATE NEW YEAR GAME NIGHT
        </p>
      </motion.section>
    </main>
  );
}
