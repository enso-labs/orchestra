export interface Document {
  name: string
  collection: string
  dateUploaded: string
}

export interface Collection {
  uuid: string
  name: string
  metadata: any
} 