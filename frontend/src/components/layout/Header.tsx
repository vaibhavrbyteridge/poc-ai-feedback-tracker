const useDummyData = import.meta.env.VITE_USE_DUMMY_DATA === "true";

interface Props {
  collectorName?: string;
}

export default function Header({ collectorName }: Props) {
  const title = useDummyData ? "All Accounts" : "All Accounts";
  const userName = collectorName || "Demo Collector";

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-2 z-40"
      style={{ marginLeft: "90px" }}
    >
      <div className="flex items-center justify-between">
        {/* Left: Collections Title */}
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0)">
              <path d="M25.545 8H11C9.34315 8 8 9.34315 8 11V28.931C8 30.5879 9.34315 31.931 11 31.931H25.545C27.2019 31.931 28.545 30.5879 28.545 28.931V11C28.545 9.34315 27.2019 8 25.545 8Z" stroke="#0078d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M52.94 8H38.395C36.7382 8 35.395 9.34315 35.395 11V15.272C35.395 16.9289 36.7382 18.272 38.395 18.272H52.94C54.5969 18.272 55.94 16.9289 55.94 15.272V11C55.94 9.34315 54.5969 8 52.94 8Z" stroke="#0078d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M52.94 25.121H38.395C36.7382 25.121 35.395 26.4641 35.395 28.121V52.94C35.395 54.5969 36.7382 55.94 38.395 55.94H52.94C54.5969 55.94 55.94 54.5969 55.94 52.94V28.121C55.94 26.4641 54.5969 25.121 52.94 25.121Z" stroke="#0078d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M25.545 38.818H11C9.34315 38.818 8 40.1611 8 41.818V52.939C8 54.5958 9.34315 55.939 11 55.939H25.545C27.2019 55.939 28.545 54.5958 28.545 52.939V41.818C28.545 40.1611 27.2019 38.818 25.545 38.818Z" stroke="#0078d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <defs>
              <clipPath id="clip0">
                <rect width="51.94" height="51.939" fill="white" transform="translate(6 6)"/>
              </clipPath>
            </defs>
          </svg>
          <h1 className="text-2xl font-bold" style={{ color: "#0078d4" }}>{title}</h1>
        </div>

        {/* Right: Header Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
            <span className="text-sm font-medium">
              {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} EST
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors">
              <div className="h-8 w-8 bg-teal-200 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-teal-700" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium">{userName}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
