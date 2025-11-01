import { NextResponse } from "next/server";
import AirtableApi from "../utils/airtable";
import BrevoApi from "../utils/brevo";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // const brevo = new BrevoApi();
    // const brevoRes = await brevo.subscribe(body);
    // if (!brevoRes.ok) {
    //   const errorData = await brevoRes.json();
    //   console.error(errorData);
    //   if (brevoRes.status === 400) {
    //     return NextResponse.json(errorData, {
    //       status: brevoRes.status,
    //     });
    //   } else {
    //     return NextResponse.json(errorData, {
    //       status: 500,
    //     });
    //   }
    // }

    const airtable = new AirtableApi();
    const airRes = await airtable.create(body);
    if (!airRes.ok) {
      const errorData = await airRes.json();
      console.log(errorData);
      return new Response(errorData, {
        status: 500,
      });
    }
    

    // Forward the successful response from Airtable to the client
    const data = {
      'message': `Successfully Subscribed!`,
      ...(await airRes.json()),
      // ...(await brevoRes.json()),
    };
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    // Handles fetch errors
    return NextResponse.json(
      { error: "Failed to subscribe" }, 
      { status: 500 }
    );
  }
}