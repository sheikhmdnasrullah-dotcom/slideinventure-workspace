import dynamic from "next/dynamic"

// Disable SSR for the whiteboard component
const Whiteboard = dynamic(() => import("./Whiteboard"), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center">Loading canvas...</div>,
})

export default Whiteboard