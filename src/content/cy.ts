/**
 * Welsh defaults, keyed by the same node ids as the English `<Ed id>` children (ADR 0004).
 *
 * ⚠️ MACHINE-DRAFTED. Every string here must be read by a fluent Welsh speaker before launch.
 * The pencil shows "draft Welsh, not yet reviewed" for any node still using one of these, and
 * saving over it in the admin clears that. A missing key falls back to English, never a hole.
 *
 * `src/content/cy.test.ts` fails if an `<Ed id>` in the source has no entry here (and isn't
 * listed in SAME_IN_BOTH), so gaps are visible rather than silent.
 */
export const cy: Record<string, string> = {
  'lang.switch': 'English',
  'brand.tagline': 'Ffenestri | Cwteri | Patios',
  'about.body':
    'Mae Compton Cleaning Services yn cynnig gwasanaethau glanhau ffenestri rheolaidd am brisiau fforddiadwy ym Mryste, Cas-gwent, Caldicot a Chasnewydd, yn enwedig ardaloedd BS16 a BS5. Gwasanaethau eraill yw glanhau a thrwsio cwteri, golchi dan bwysau a glanhau rendr.',
  'about.base': 'Rydym wedi’n lleoli yn Lyde Green, Bryste ar hyn o bryd.',
  'nav.services': 'Gwasanaethau',
  'nav.prices': 'Prisiau',
  'nav.contact': 'Cysylltu â ni',
  'nav.reviews': 'Adolygiadau',
  'nav.call': 'Ffoniwch',
  'nav.text': 'Tecstiwch',
  'services.title': 'Gwasanaethau',
  'services.windows.title': 'Glanhau ffenestri',
  'services.windows.body':
    'Rydym yn arbenigo mewn cynnal a chadw ffenestri’n rheolaidd. Mae glanhau rheolaidd yn cynnwys ffenestri, fframiau, drysau a siliau. Mae’r ychwanegiadau dewisol yn cynnwys y tu mewn, toeau gwydr a glanhau conservatory cyflawn.',
  'services.gutters.title': 'Cwteri',
  'services.gutters.body':
    'Gall gwaith cwteri gynnwys cael gwared ar falurion o’r cwter a/neu’r bibell lawr, glanhau’r tu allan a’r ffasgia, neu drwsio’r cwteri.',
  'services.other.title': 'Gwaith arall rydym yn ei wneud',
  'services.other.body': 'Golchi dan bwysau · Glanhau rendr · Mân waith trwsio allanol',
  'prices.title': 'Prisiau',
  'prices.first.label':
    'Cost gyfartalog y glanhau cyntaf ar gyfer cartref teras neu led-ddatgysylltiedig yw',
  'prices.factors.title': 'Pethau i’w hystyried',
  'prices.factors.list': 'Maint · Lleoliad · Brys',
  'prices.regular': 'Gostyngiadau ar gyfer glanhau rheolaidd',
  'prices.cta': 'Am y pris gorau, cysylltwch â ni',
  'contact.title': 'Cysylltu â ni',
  'contact.intro': 'Cysylltwch drwy neges destun neu ffoniwch',
  'contact.form.title': 'Ffurflen gyswllt',
  'contact.form.name': 'Enw',
  'contact.form.address': 'Cyfeiriad',
  'contact.form.either': 'Sut gallwn ni gysylltu â chi? Rhif ffôn neu e-bost: un o leiaf.',
  'contact.form.phone': 'Ffôn',
  'contact.form.phone.error': 'Dydy hynny ddim yn edrych fel rhif ffôn yn y DU. Rhowch gynnig ar rif fel 07xxx xxxxxx.',
  'contact.form.email': 'E-bost',
  'contact.form.email.error': 'Dydy’r cyfeiriad e-bost hwnnw ddim yn edrych yn iawn. Gwiriwch ef.',
  'contact.form.email.domain': 'Doedden ni ddim yn gallu dod o hyd i barth yr e-bost hwnnw. Gwiriwch y sillafu, neu defnyddiwch eich rhif ffôn.',
  'contact.form.contact.error': 'Rhowch rif ffôn neu e-bost i ni er mwyn i ni allu ateb.',
  'contact.form.postcode': 'Cod post',
  'contact.form.postcode.error': 'Rhowch god post llawn go iawn yn y DU, fel BS16 1AA.',
  'contact.form.postcode.unknown': 'Doedden ni ddim yn gallu dod o hyd i’r cod post hwnnw. Gwiriwch ef, neu ffoniwch ni.',
  'nav.email': 'E-bost',
  'contact.loc.use': 'Defnyddio fy lleoliad',
  'contact.loc.denied': 'Mae lleoliad wedi’i flocio yn eich porwr. Dim problem: teipiwch eich cyfeiriad a’ch cod post yn lle hynny.',
  'contact.loc.failed': 'Doedden ni ddim yn gallu dod o hyd i chi nawr. Teipiwch eich cyfeiriad a’ch cod post yn lle hynny.',
  'contact.loc.confirm': 'Tapiwch y map neu llusgwch y pin i’ch cartref i gadarnhau i ble rydyn ni’n mynd, yna anfonwch.',
  'contact.loc.confirmed': '✓ Lleoliad wedi’i gadarnhau. Diolch.',
  'contact.check.title': 'Dyma’r cyfeiriad a ddaethon ni o hyd iddo. Ydy e’n iawn?',
  'contact.check.nostreet': 'Dim ond y cod post a ddaethon ni o hyd iddo. Teipiwch rif eich tŷ a’ch stryd uchod.',
  'contact.check.pending': 'Dywedwch os yw hyn yn iawn, yna anfonwch.',
  'contact.check.yes': 'Ydy, mae’n iawn',
  'contact.check.no': 'Na, fe’i cywiraf',
  'contact.sent.title': 'Dyma’r hyn a anfonoch atom:',
  'contact.sent.pin': '✓ Y pin a gadarnhawyd gennych ar y map',
  'contact.sent.reply': 'Byddwn yn ateb gan ddefnyddio’r rhif ffôn neu’r e-bost uchod. Os oes unrhyw beth o’i le, ffoniwch neu tecstiwch ni.',
  'contact.form.service': 'Pa wasanaeth sydd o ddiddordeb i chi?',
  'contact.form.service.error': 'Dewiswch y gwasanaeth sydd o ddiddordeb i chi.',
  'contact.form.source': 'Ble clywsoch chi amdanom ni? (dewisol)',
  'contact.form.notes': 'Nodiadau (dewisol)',
  'contact.form.rate': 'Gormod o negeseuon ar hyn o bryd. Ffoniwch neu tecstiwch ni yn lle hynny.',
  'contact.form.submit': 'Anfon',
  'contact.form.thanks': 'Diolch, byddwn mewn cysylltiad cyn bo hir.',
  'contact.form.error': 'Gwiriwch eich manylion a rhowch gynnig arall arni, neu rhowch alwad i ni.',
  'reviews.title': 'Adolygiadau',
  'reviews.empty': 'Mae adolygiadau cwsmeriaid yn dod yn fuan.',
  'reviews.cta': 'Gadewch adolygiad Google i ni',
  'footer.copy': '© Compton Cleaning Services',
};

/** Ids whose wording is deliberately identical in both languages (names, brands, numbers). */
export const SAME_IN_BOTH = new Set<string>(['brand.name', 'brand.web', 'nav.whatsapp', 'prices.first.amount']);
