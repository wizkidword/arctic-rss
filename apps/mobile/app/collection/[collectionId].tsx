import { useLocalSearchParams } from "expo-router"

import { ReaderScreen } from "@/screens/reader-screen"

export default function CollectionScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>()
  const value = Array.isArray(collectionId) ? collectionId[0] : collectionId
  return <ReaderScreen collectionId={value} />
}
