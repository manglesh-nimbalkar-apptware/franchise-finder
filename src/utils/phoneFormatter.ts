/**
 * Formats various phone number formats to a standardized +1 format
 * Example: (303) 832-6000 -> +1 303-832-6000
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone || phone === 'N/A') return 'N/A';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // US numbers are typically 10 digits, or 11 with country code
  if (digits.length < 10) return phone; // Not enough digits to be a valid number
  
  let formattedNumber: string;
  
  if (digits.length === 10) {
    // Format as: +1 XXX-XXX-XXXX
    formattedNumber = `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Format as: +1 XXX-XXX-XXXX
    formattedNumber = `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else {
    // For non-US or unusual formats, just add +1 if it seems like a US number
    formattedNumber = `+1 ${digits.slice(-10, -7)}-${digits.slice(-7, -4)}-${digits.slice(-4)}`;
  }
  
  return formattedNumber;
};
