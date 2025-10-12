export type Ausschreibung = {
  id: number;
  abgabefrist: string | null; // ISO date
  uhrzeit: string | null;
  ort: string | null;
  name: string;
  kurzbesch_auftrag: string | null;
  teilnahme: string | null;
  grund_bei_ablehnung: string | null;
  bearbeiter: string | null;
  bemerkung: string | null;
  abgegeben: boolean | null;
  abholfrist: string | null;
  fragefrist: string | null;
  besichtigung: string | null;
  bewertung: string | null;
  zuschlagsfrist: string | null;
  ausfuehrung: string | null;
  vergabe_nr: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
};
