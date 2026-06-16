const UUID_RE =

  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;



const RESERVED_SEGMENTS = new Set(["index", "current"]);



export function isTicketUuid(value: string | null | undefined): value is string {

  return !!value && UUID_RE.test(value);

}



/** Resolve a real ticket UUID from route param or persisted store — never "index" / "current". */

export function resolveTicketId(

  routeParam: string | string[] | undefined,

  storeId: string | null | undefined,

): string | undefined {

  const raw = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  if (raw && !RESERVED_SEGMENTS.has(raw) && isTicketUuid(raw)) {

    return raw;

  }

  if (isTicketUuid(storeId ?? undefined)) {

    return storeId!;

  }

  return undefined;

}

