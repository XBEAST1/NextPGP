"use server";

import { google } from "googleapis";
import nodemailer from "nodemailer";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://nextpgp.vercel.app"
    : "http://localhost:3000";
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN!;
const GMAIL_EMAIL = process.env.GMAIL_EMAIL!;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    if (!accessToken.token) {
      throw new Error("Failed to acquire access token.");
    }

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GMAIL_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    const mailOptions = {
      from: `"NextPGP" <${GMAIL_EMAIL}>`,
      to,
      subject,
      html,
    };

    const result = await transport.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
