import { NextResponse } from "next/server";
import BrevoApi from "../utils/brevo";

export async function POST(request: Request) {
  try {
    const brevo = new BrevoApi();
    const response = await brevo.subscribe(request);

    if (!response.ok) {
      // Handles Airtable API errors
      const errorData = await response.json();
      console.log(errorData);
      return new Response(errorData, {
        status: 500,
      });
    }

    // Forward the successful response from Airtable to the client
    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    // Handles fetch errors
    console.log(error)
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 },
    );
  }
}
