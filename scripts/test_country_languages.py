import unittest
from country_languages import parse_languages


class CountryLanguageParsingTest(unittest.TestCase):
    def test_creoles_and_etymology_do_not_become_other_languages(self):
        languages, untranslated, entries = parse_languages(
            'Papiamento (a Spanish-Portuguese-Dutch-English dialect) 69.4%, English 7.1%, French patois')
        self.assertEqual([language['id'] for language in languages], ['pap', 'eng'])
        self.assertEqual(untranslated, ['French patois'])
        self.assertEqual(len(entries), 3)

    def test_untranslated_and_mixed_entries_keep_source_order(self):
        source = 'Dari and Pashto, Pashto (source-described status) 48%, Nuristani 1%, Greek (including regional, local varieties)'
        languages, untranslated, entries = parse_languages(source)
        self.assertEqual([language['id'] for language in languages], ['pus', 'ell'])
        self.assertEqual(untranslated, ['Dari and Pashto', 'Nuristani 1%'])
        self.assertEqual(entries, ['Dari and Pashto', 'Pashto (source-described status) 48%', 'Nuristani 1%', 'Greek (including regional, local varieties)'])

    def test_repeated_aliases_and_unfamiliar_names_are_not_lost(self):
        languages, untranslated, entries = parse_languages('Persian; Farsi; an unfamiliar language')
        self.assertEqual([language['id'] for language in languages], ['fas'])
        self.assertEqual(untranslated, ['Farsi', 'an unfamiliar language'])
        self.assertEqual(set(entries), {language['sourceLabel'] for language in languages} | set(untranslated))


if __name__ == '__main__':
    unittest.main()
