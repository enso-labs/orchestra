
export default class BrevoApi {
    apiKey: string;
    url: string;
    headers: any;

    constructor() {
        this.apiKey = process.env.BREVO_API_KEY || '';
        this.url = "https://api.brevo.com/v3/contacts";
        this.headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        };
    }

    public async subscribe(body: any) {
      // Forward the request to Airtable
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ email: body.Email, listIds: [6], updateEnabled: false }),
      });
      return response;
    }
}