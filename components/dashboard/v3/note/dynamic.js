import dynamic from "next/dynamic"

// Disable SSR for the editor component
const NotionEditor = dynamic(() => import("./NotionEditor"), {
  ssr: false,
  loading: () => <div className="p-6 text-gray-500">Loading document editor...</div>,
})

export default NotionEditor