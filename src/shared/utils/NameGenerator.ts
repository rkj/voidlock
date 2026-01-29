import { PRNG } from "../PRNG";

export const FIRST_NAMES = [
  "Kyle", "Ellen", "Dwayne", "Jenette", "Ricco", "Mark", "Tim", "Cynthia",
  "Colette", "Daniel", "Trevor", "William", "Leonard", "Sarah", "Michael"
];

export const LAST_NAMES = [
  "Hicks", "Vasquez", "Ripley", "Apone", "Hudson", "Drake", "Frost",
  "Ferro", "Spunkmeyer", "Dietrich", "Crowe", "Wierzbowski", "Gorman",
  "Bishop", "Burke", "Newt", "Connor", "Reese", "Sarah"
];

/**
 * Generates random sci-fi/military flavor names.
 */
export class NameGenerator {
  /**
   * Generates a full name (First Last).
   * @param prng Optional PRNG instance for deterministic generation. If omitted, uses Math.random.
   */
  public static generate(prng?: PRNG): string {
    const firstName = this.pickRandom(FIRST_NAMES, prng);
    const lastName = this.pickRandom(LAST_NAMES, prng);
    return `${firstName} ${lastName}`;
  }

  private static pickRandom<T>(array: T[], prng?: PRNG): T {
    const index = prng
      ? prng.nextInt(0, array.length)
      : Math.floor(Math.random() * array.length);
    return array[index];
  }
}
