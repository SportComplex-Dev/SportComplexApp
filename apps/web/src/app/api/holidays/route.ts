import { NextResponse } from "next/server";
import { getColombiaHolidays, TIMEZONE } from "@sportcomplex/core";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultYear = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
    }).format(now);

    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : parseInt(defaultYear, 10);

    if (isNaN(year) || year < 2020 || year > 2030) {
      return NextResponse.json(
        { success: false, error: "Año inválido" },
        { status: 400 }
      );
    }

    const holidays = await getColombiaHolidays(year);

    return NextResponse.json(
      {
        success: true,
        year,
        holidays,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      }
    );
  } catch (error) {
    console.error("Error en GET /api/holidays:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener festivos" },
      { status: 500 }
    );
  }
}
