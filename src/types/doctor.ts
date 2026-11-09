/** Doctors: as patients see them, and the signed-in doctor's own data. */

/** A doctor as patients see them: the care-team card and the doctor sheet on Care. */
export type DoctorSummary = {
  id: number;
  fullName: string;
  photoUrl: string | null;
  specialization: string;
  qualifications: string;
  experience: string;
  languages: string[];
  about: string;
  consultationFee: number | null;
  rating: number | null;
};

/** The patient's care team (GET /api/care-team). `doctor` is null until the first consultation. */
export type CareTeam = { doctor: DoctorSummary | null };

/** The signed-in doctor (GET /api/doctor/me). */
export type DoctorProfile = {
  id: number | null;
  fullName: string;
  specialization: string;
  photoUrl: string | null;
};

/** A patient in the doctor's list (GET /api/doctor/patients). */
export type DoctorPatient = {
  id: string;
  fullName: string;
  age: number | null;
  sex: string;
  mobile: string;
};

/** One stretch of working time on a weekday, India time ("09:00" to "13:30"). `weekday` is ISO: 1 is Monday, 7 Sunday. */
export type WorkingRange = { weekday: number; start: string; end: string };

/**
 * The signed-in doctor's bookable hours (GET /api/doctor/availability). `usesDefault` is true until
 * the doctor saves their own week; `daysOff` are "YYYY-MM-DD", today onward; `bookedOutside` counts
 * booked consultations that fall outside these hours and stay booked.
 */
export type DoctorAvailability = {
  weekly: WorkingRange[];
  daysOff: string[];
  usesDefault: boolean;
  bookedOutside: number;
};
