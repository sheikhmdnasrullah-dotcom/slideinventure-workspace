import dynamic from "next/dynamic"

// Disable SSR for the notepad component
const Notepad = dynamic(() => import("./Notepad"), {
  ssr: false,
  loading: () => <div className="p-6 text-gray-500">Loading notepad...</div>,
})

export default Notepad