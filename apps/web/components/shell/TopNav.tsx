import React from 'react';
import { Bell, Menu, Search } from 'lucide-react';

export function TopNav({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-[22px] border-b border-[#e7ebf2] bg-white px-4 md:px-7">
      <button type="button" onClick={onMenu} className="text-[#152b50] md:hidden" aria-label="Toggle navigation"><Menu className="h-5 w-5" /></button>
      <div className="flex flex-1">
        <form className="flex w-full" action="/" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <div className="relative w-full max-w-[1270px] text-[#152b50]">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <Search className="h-[19px] w-[19px]" aria-hidden="true" />
            </div>
            <input
              id="search-field"
              className="block h-[42px] w-full rounded-lg border border-[#dbe2ed] bg-transparent py-2 pl-12 pr-3 text-[13px] text-[#162849] outline-none placeholder:text-[#8796b4] focus:border-[#aebed8]"
              placeholder="Search projects, scenes, or assets..."
              type="search"
              name="search"
            />
          </div>
        </form>
      </div>
      <div className="ml-auto flex items-center gap-5">
        <button
          type="button"
          className="rounded-full bg-white p-1 text-[#10254d] hover:bg-slate-50"
        >
          <span className="sr-only">View notifications</span>
          <Bell className="h-[21px] w-[21px]" aria-hidden="true" />
        </button>
        <div className="flex items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf2ff] text-[13px] font-medium text-[#10254d]">
            OP
          </div>
        </div>
      </div>
    </header>
  );
}
