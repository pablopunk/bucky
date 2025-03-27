import nodemailer from "nodemailer";
import { getDatabase } from "./db";
import type { SMTPConfig } from "./db";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(to: string, subject: string, body: string) {
  try {
    const db = getDatabase();
    const smtpConfig = db.prepare("SELECT * FROM smtp_config ORDER BY id DESC LIMIT 1").get() as SMTPConfig | null;

    if (!smtpConfig) {
      throw new Error("SMTP configuration not found");
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    });

    await transporter.sendMail({
      from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
      to,
      subject,
      html: body,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export async function sendBackupNotification(
  jobName: string,
  status: "success" | "failed",
  message: string,
  to: string
): Promise<void> {
  const subject = `Backup ${status === "success" ? "Successful" : "Failed"}: ${jobName}`;
  const text = `
Backup Job: ${jobName}
Status: ${status}
Time: ${new Date().toLocaleString()}

${message}
`;
  const html = `
<h1>Backup ${status === "success" ? "Successful" : "Failed"}</h1>
<p><strong>Backup Job:</strong> ${jobName}</p>
<p><strong>Status:</strong> ${status}</p>
<p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
<p>${message}</p>
`;

  await sendEmail(to, subject, html);
}

export async function sendQuotaWarning(
  providerName: string,
  usedSpace: number,
  totalSpace: number,
  to: string
): Promise<void> {
  const usagePercentage = Math.round((usedSpace / totalSpace) * 100);
  const subject = `Storage Quota Warning: ${providerName}`;
  const text = `
Storage Provider: ${providerName}
Current Usage: ${usagePercentage}%
Used Space: ${formatBytes(usedSpace)}
Total Space: ${formatBytes(totalSpace)}

Your storage space is running low. Please take action to prevent backup failures.
`;
  const html = `
<h1>Storage Quota Warning</h1>
<p><strong>Storage Provider:</strong> ${providerName}</p>
<p><strong>Current Usage:</strong> ${usagePercentage}%</p>
<p><strong>Used Space:</strong> ${formatBytes(usedSpace)}</p>
<p><strong>Total Space:</strong> ${formatBytes(totalSpace)}</p>
<p>Your storage space is running low. Please take action to prevent backup failures.</p>
`;

  await sendEmail(to, subject, html);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
} 