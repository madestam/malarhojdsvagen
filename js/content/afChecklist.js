// "Kom igång med Arbetsförmedlingen" — innehåll och länkar.
// Källor kontrollerade mot arbetsformedlingen.se i augusti 2026.
export const AF_CHECKLIST = {
  title: 'Kom igång med Arbetsförmedlingen',
  updated: '2026-08',
  disclaimer: 'Reglerna kan ändras – dubbelkolla alltid vad som gäller just nu på arbetsformedlingen.se.',
  steps: [
    {
      id: 'skriv-in',
      title: 'Skriv in dig på Arbetsförmedlingen',
      short: 'Digitalt med BankID – helst din första arbetslösa dag.',
      body:
        'Skriv in dig via Arbetsförmedlingens digitala tjänst med BankID, helst din ' +
        'första arbetslösa dag – tjänsten är öppen 07.00–24.00, även helger. Datumet ' +
        'spelar roll: ersättning kan i regel bara räknas från den dag du är inskriven.',
      links: [
        { label: 'Skriv in dig (Mina sidor)', url: 'https://arbetsformedlingen.se/for-arbetssokande/mina-sidor/skriv-in-dig' },
        { label: 'Arbetslös – vad händer nu?', url: 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu' },
      ],
    },
    {
      id: 'a-kassa',
      title: 'Ansök om ersättning hos a-kassan',
      short: 'Ersättningen söker du hos a-kassan, inte hos Arbetsförmedlingen.',
      body:
        'Är du med i en a-kassa? Logga in hos din a-kassa och ansök om ersättning så ' +
        'snart du skrivit in dig. Är du inte medlem kan du ändå ha rätt till ' +
        'grundersättning – kolla vad som gäller för dig.',
      links: [
        { label: 'Ersättning från a-kassa', url: 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu/ersattning-fran-a-kassa' },
        { label: 'Hitta din a-kassa', url: 'https://www.sverigesakassor.se' },
      ],
    },
    {
      id: 'planeringssamtal',
      title: 'Ha ditt planeringssamtal',
      short: 'Ditt första samtal med en arbetsförmedlare – förbered dig.',
      body:
        'Efter inskrivningen bokas ett planeringssamtal med en arbetsförmedlare, ofta ' +
        'per telefon eller video. Förbered: vad du kan, vad du vill jobba med och vad ' +
        'som hindrar dig. Missa inte samtalet – det kan påverka din ersättning.',
      links: [
        { label: 'Inför planeringssamtalet', url: 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu/infor-planeringssamtalet' },
      ],
    },
    {
      id: 'handlingsplan',
      title: 'Följ din handlingsplan',
      short: 'Er gemensamma plan – finns på Mina sidor.',
      body:
        'I samtalet tar ni fram en handlingsplan: vilka jobb du ska söka och vilket ' +
        'stöd du får. Den ligger på Mina sidor. Det du gör enligt planen är också det ' +
        'du redovisar i aktivitetsrapporten varje månad.',
      links: [
        { label: 'Mina sidor', url: 'https://arbetsformedlingen.se/for-arbetssokande/mina-sidor' },
      ],
    },
    {
      id: 'aktivitetsrapport',
      title: 'Aktivitetsrapportera den 1–14 varje månad',
      important: true,
      short: 'Missad rapport kan ge varning eller indragen ersättning.',
      body:
        'Mellan den 1:a och 14:e varje månad rapporterar du vilka jobb du sökt och vad ' +
        'du gjort föregående månad, på Mina sidor med BankID. Missar du rapporten kan ' +
        'du få en varning och därefter förlora ersättningsdagar. Tips: ansökningslistan ' +
        'här i appen är ditt underlag – logga varje sökt jobb direkt så är rapporten ' +
        'nästan färdig.',
      links: [
        { label: 'Aktivitetsrapportera', url: 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu/aktivitetsrapportera' },
      ],
    },
    {
      id: 'cv',
      title: 'Fixa cv, personligt brev och LinkedIn',
      short: 'Anpassa cv:t till varje annons – och håll LinkedIn uppdaterad.',
      body:
        'Se till att ditt cv är aktuellt och anpassa det till varje annons i stället ' +
        'för att skicka samma överallt. Arbetsförmedlingen har guider, mallar och ' +
        'webbinarier för cv och personligt brev. Uppdatera gärna LinkedIn också – ' +
        'många rekryterare söker där.',
      links: [
        { label: 'Cv, ansökan och intervju', url: 'https://arbetsformedlingen.se/for-arbetssokande/cv-ansokan-och-intervju' },
        { label: 'LinkedIn', url: 'https://www.linkedin.com' },
      ],
    },
    {
      id: 'platsbanken',
      title: 'Sök jobb via Platsbanken – och logga dem här',
      short: 'Sätt upp bevakningar och logga varje ansökan i listan nedan.',
      body:
        'Platsbanken är Sveriges största jobbsajt. Sök på yrke och område och spara ' +
        'bevakningar så att nya annonser kommer till dig. Varje jobb du söker: lägg in ' +
        'det i ansökningslistan här – då räknas det mot ditt veckomål och blir ' +
        'underlag till aktivitetsrapporten.',
      links: [
        { label: 'Platsbanken', url: 'https://arbetsformedlingen.se/platsbanken' },
        { label: 'Kom igång med jobbsökandet', url: 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu/kom-igang-med-ditt-jobbsokande' },
      ],
    },
  ],
};

export const AKTIVITETSRAPPORT_URL = 'https://arbetsformedlingen.se/for-arbetssokande/arbetslos---vad-hander-nu/aktivitetsrapportera';
export const PLATSBANKEN_URL = 'https://arbetsformedlingen.se/platsbanken';

// Diskret vuxen peppning — roteras deterministiskt på antal ansökningar.
export const UPPMUNTRAN_SOKT = [
  'Loggad. Bra jobbat!',
  'En till på listan – bra tempo.',
  'Klockrent. Vidare till nästa.',
];
