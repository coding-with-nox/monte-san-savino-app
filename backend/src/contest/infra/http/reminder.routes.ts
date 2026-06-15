import { Elysia, t } from "elysia";
import { requireRole } from "../../../identity/infra/http/role.middleware";
import { tenantMiddleware } from "../../../tenancy/infra/http/tenant.middleware";
import { emailService } from "../../../shared/infra/email/emailService";

export const reminderRoutes = new Elysia({ prefix: "/admin/reminders" })
  .use(tenantMiddleware)
  .use(requireRole("manager"))
  .post(
    "/incomplete-registrations",
    async ({ body }) => {
      // TODO: query tenant DB for users enrolled in campaignId's event with no models
      // For each: call emailService.sendIncompleteRegistrationReminder(...)
      // Return count of emails sent
      return { sent: 0, message: "TODO: not yet implemented — scaffold only" };
    },
    {
      body: t.Object({
        campaignId: t.String(),
      }),
      detail: {
        summary: "Trigger manual reminder for incomplete registrations (admin)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    }
  );
