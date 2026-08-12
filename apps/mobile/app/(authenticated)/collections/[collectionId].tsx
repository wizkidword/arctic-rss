import { Redirect, useLocalSearchParams } from "expo-router"

export default function LegacyCollectionRoute() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>()
  return <Redirect href={{ pathname: "/collection/[collectionId]", params: { collectionId: Array.isArray(collectionId) ? collectionId[0] : collectionId } }} />
}
