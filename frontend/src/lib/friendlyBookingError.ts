/** Map raw booking/reservation API errors to short staff-facing copy. */
export function friendlyBookingError(raw: string): string {
  const msg = (raw || "").trim();
  if (!msg) return "Booking failed. Please try again.";

  const lower = msg.toLowerCase();

  if (
    lower.includes("no vacant_clean") ||
    lower.includes("room_unavailable") ||
    lower.includes("no vacant") ||
    (lower.includes("no rooms") && lower.includes("roomtype"))
  ) {
    return "No clean vacant rooms are available for this room type and dates. Try different dates, another room type, free a room (check-out/cancel), or pick a specific available room.";
  }
  if (lower.includes("preferred room does not match") || lower.includes("must match the selected room type")) {
    return "The preferred room does not match the selected room type. Clear the room choice or pick a matching room.";
  }
  if (lower.includes("preferred room not found")) {
    return "The preferred room was not found. Clear the room selection and try again.";
  }
  if (lower.includes("already reserved") || lower.includes("overlapping")) {
    return "That room is already booked for overlapping dates. Choose another room or change the stay dates.";
  }
  if (lower.includes("active block")) {
    return "That room has an active block for these dates. Choose another room or change the stay dates.";
  }
  if (lower.includes("not available for assignment") || lower.includes("room is not available")) {
    return "That room is not available right now (dirty, occupied, blocked, or out of order). Choose another room.";
  }
  if (lower.includes("occupancy exceeds") || lower.includes("capacity insufficient")) {
    return "Too many guests for this room type. Reduce adults or choose a larger room type.";
  }
  if (lower.includes("checkoutdate must be after") || lower.includes("check-out must be after")) {
    return "Check-out must be after check-in.";
  }
  if (lower.includes("check_in_in_past") || lower.includes("check-in date cannot be in the past")) {
    return "Check-in cannot be in the past. Choose today or a future date.";
  }
  if (lower.includes("check_out_in_past") || lower.includes("check-out date cannot be in the past")) {
    return "Check-out cannot be in the past. Choose a future check-out date.";
  }
  if (lower.includes("room_rate_required") || lower.includes("nightly rate must be greater")) {
    return "This room type has no valid price for the stay. Set a rate or choose another room type.";
  }
  if (lower.includes("guest_national_id_exists") || lower.includes("national id already exists")) {
    return "A guest with this national ID already exists. Search and select that guest instead of creating a new one.";
  }
  if (lower.includes("guest not found")) {
    return "Guest profile not found. Go back to Guest and search or create the guest again.";
  }
  if (lower.includes("blacklisted")) {
    return "This guest is blacklisted and cannot be booked.";
  }

  // Strip internal IDs if a long technical message slipped through
  if (/roomTypeId=|hotelId=|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(msg)) {
    return "No rooms are available for the selected type and dates. Try different dates, another room type, or pick a specific available room.";
  }

  return msg;
}
