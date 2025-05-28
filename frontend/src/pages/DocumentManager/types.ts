export interface Document {
  metadata: {
    filename: string
    source: null | string
    creationdate: string
    total_pages: number
  }
  collection: string
  dateUploaded: string
  uuid: string
}

export interface Collection {
  uuid: string
  name: string
  metadata: any
} 