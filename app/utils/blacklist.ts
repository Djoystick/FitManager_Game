export const NAME_BLACKLIST = new Set([
  // Current & Former Superstars (EA & FIFPro protected)
  "Lionel Messi", "Cristiano Ronaldo", "Neymar Jr", "Kylian Mbappe", "Erling Haaland",
  "Kevin De Bruyne", "Mohamed Salah", "Robert Lewandowski", "Luka Modric", "Karim Benzema",
  "Vinicius Junior", "Harry Kane", "Sadio Mane", "Son Heung-min", "Virgil van Dijk",
  "Thibaut Courtois", "Alisson Becker", "Ederson Moraes", "Manuel Neuer", "Marc-Andre ter Stegen",
  "Sergio Ramos", "Gerard Pique", "Dani Alves", "Marcelo Vieira", "Thiago Silva",
  "Jude Bellingham", "Pedri", "Gavi", "Jamal Musiala", "Bukayo Saka",
  "Phil Foden", "Marcus Rashford", "Raheem Sterling", "Jadon Sancho", "Jack Grealish",
  "Bruno Fernandes", "Bernardo Silva", "Ruben Dias", "Joao Cancelo", "Diogo Jota",
  "Antoine Griezmann", "Paul Pogba", "N'Golo Kante", "Ousmane Dembele", "Kingsley Coman",
  "Toni Kroos", "Joshua Kimmich", "Thomas Muller", "Leroy Sane", "Serge Gnabry",
  "Romelu Lukaku", "Eden Hazard", "Thierry Henry", "Zinedine Zidane", "Ronaldinho",
  "Ronaldo Nazario", "Pele", "Diego Maradona", "Johan Cruyff", "Michel Platini",
  "Franz Beckenbauer", "Paolo Maldini", "Roberto Carlos", "Cafu", "Xavi Hernandez",
  "Andres Iniesta", "Sergio Busquets", "Iker Casillas", "Gianluigi Buffon", "Andrea Pirlo",
  "Francesco Totti", "Alessandro Del Piero", "Roberto Baggio", "David Beckham", "Paul Scholes",
  "Ryan Giggs", "Roy Keane", "Patrick Vieira", "Dennis Bergkamp", "Wayne Rooney",
  "Steven Gerrard", "Frank Lampard", "John Terry", "Ashley Cole", "Rio Ferdinand",
  "Nemanja Vidic", "Petr Cech", "Didier Drogba", "Samuel Eto'o", "Yaya Toure",
  "Victor Osimhen", "Khvicha Kvaratskhelia", "Rafael Leao", "Theo Hernandez", "Sandro Tonali",
  "Federico Valverde", "Rodrygo Goes", "Aurelien Tchouameni", "Eduardo Camavinga", "Eder Militao",
  "Ronald Araujo", "Frenkie de Jong", "Lautaro Martinez", "Nicolo Barella", "Alessandro Bastoni",
  "Martin Odegaard", "Declan Rice", "Gabriel Martinelli", "William Saliba", "Gabriel Jesus",
  // Coaches
  "Pep Guardiola", "Jurgen Klopp", "Carlo Ancelotti", "Jose Mourinho", "Diego Simeone",
  "Zinedine Zidane", "Mikel Arteta", "Erik ten Hag", "Thomas Tuchel", "Antonio Conte"
].map(name => name.toLowerCase()));

/**
 * Normalizes a name to check against the blacklist.
 */
export function isNameBlacklisted(name: string): boolean {
  return NAME_BLACKLIST.has(name.toLowerCase().trim());
}
