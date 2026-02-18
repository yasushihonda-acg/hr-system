import { zValidator } from "@hono/zod-validator";
import { collections, type Employee } from "@hr-system/db";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO } from "../lib/serialize.js";

const listQuerySchema = z.object({
  employmentType: z.enum(["full_time", "part_time", "visiting_nurse"]).optional(),
  department: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const app = new Hono();

/**
 * GET /api/employees
 * 従業員一覧
 */
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { employmentType, department, isActive } = c.req.valid("query");
  const { limit, offset } = parsePagination(c.req.query());

  let query = collections.employees.orderBy("name", "asc") as FirebaseFirestore.Query;
  if (employmentType) query = query.where("employmentType", "==", employmentType);
  if (department) query = query.where("department", "==", department);
  if (isActive !== undefined) query = query.where("isActive", "==", isActive === "true");

  const [countSnap, docsSnap] = await Promise.all([
    query.count().get(),
    query.limit(limit).offset(offset).get(),
  ]);

  const total = countSnap.data().count;
  const employees = docsSnap.docs.map((doc) => {
    const e = doc.data();
    return {
      id: doc.id,
      employeeNumber: e.employeeNumber,
      name: e.name,
      email: e.email,
      employmentType: e.employmentType,
      department: e.department,
      position: e.position,
      hireDate: toISO(e.hireDate),
      isActive: e.isActive,
    };
  });

  return c.json({ employees, total, limit, offset });
});

/**
 * GET /api/employees/:id
 * 従業員詳細（現行給与を含む）
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const empSnap = await collections.employees.doc(id).get();
  if (!empSnap.exists) notFound("Employee", id);

  const emp = empSnap.data() as Employee;

  // 現行有効給与を取得（effectiveTo が null のもの）
  const salarySnap = await collections.salaries
    .where("employeeId", "==", id)
    .where("effectiveTo", "==", null)
    .limit(1)
    .get();

  const salary = salarySnap.docs[0]
    ? (() => {
        const s = salarySnap.docs[0].data();
        return {
          id: salarySnap.docs[0].id,
          baseSalary: s.baseSalary,
          positionAllowance: s.positionAllowance,
          regionAllowance: s.regionAllowance,
          qualificationAllowance: s.qualificationAllowance,
          otherAllowance: s.otherAllowance,
          totalSalary: s.totalSalary,
          effectiveFrom: toISO(s.effectiveFrom),
        };
      })()
    : null;

  return c.json({
    id,
    employeeNumber: emp.employeeNumber,
    name: emp.name,
    email: emp.email,
    googleChatUserId: emp.googleChatUserId,
    employmentType: emp.employmentType,
    department: emp.department,
    position: emp.position,
    hireDate: toISO(emp.hireDate),
    isActive: emp.isActive,
    createdAt: toISO(emp.createdAt),
    updatedAt: toISO(emp.updatedAt),
    currentSalary: salary,
  });
});

export { app as employeeRoutes };
