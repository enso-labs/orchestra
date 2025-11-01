import { Contact } from "@/types";

class APIClient {
  async contactFormSubmit(body: Contact): Promise<any> {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return response;
  }

  async subscribeToNewsletter(body: { email: string }): Promise<any> {
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
		console.log(data)
    return data;
  }
}

export const apiClient = new APIClient();
