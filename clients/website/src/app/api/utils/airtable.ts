

export default class AirtableApi {
  apiKey: string;
  url: string;
  headers: any;

  constructor() {
    this.apiKey = process.env.AIRTABLE_API_KEY || "";
    this.url = "https://api.airtable.com/v0/app6sU4AprV9uZze6/Contacts";
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  public async create(body: any) {
    delete body.Message; // If to Prompt Engineers AI contact list.
    // Forward the request to Airtable
    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ fields: body }),
    });
    return response;
  }
}