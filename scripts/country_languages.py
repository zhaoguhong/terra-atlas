"""Read the fixed source's list, retaining unfamiliar names instead of dropping them."""
import re

# Translations are display labels, not a language taxonomy or official-status table.
# Match whole source labels; a creole or a parenthetical etymology is not its source language.
LABELS = [
    ('eng', '英语', ['English']), ('zho', '汉语', ['Chinese', 'Mandarin', 'Standard Chinese or Mandarin', 'Chinese languages', 'Chinese dialects', 'Northern Chinese']),
    ('spa', '西班牙语', ['Spanish', 'Castilian']), ('fra', '法语', ['French']),
    ('ara', '阿拉伯语', ['Arabic', 'Standard Arabic']), ('rus', '俄语', ['Russian']),
    ('por', '葡萄牙语', ['Portuguese']), ('hin', '印地语', ['Hindi']),
    ('deu', '德语', ['German']), ('jpn', '日语', ['Japanese']),
    ('kor', '朝鲜语／韩语', ['Korean']), ('ind', '印度尼西亚语', ['Indonesian', 'Bahasa Indonesia']),
    ('tur', '土耳其语', ['Turkish']), ('swa', '斯瓦希里语', ['Swahili', 'Kiswahili', 'Kiswahili or Swahili', 'Swahili/Kiswahili']),
    ('ben', '孟加拉语', ['Bengali', 'Bangla']), ('urd', '乌尔都语', ['Urdu']),
    ('fas', '波斯语', ['Persian', 'Farsi', 'Persian Farsi']),
    ('prs', '达里语', ['Afghan Persian or Dari']),
    ('ita', '意大利语', ['Italian']), ('vie', '越南语', ['Vietnamese']), ('tha', '泰语', ['Thai']),
    ('msa', '马来语', ['Malay', 'Bahasa Malaysia']), ('tam', '泰米尔语', ['Tamil']),
    ('nld', '荷兰语', ['Dutch']), ('pol', '波兰语', ['Polish']), ('ukr', '乌克兰语', ['Ukrainian']),
    ('nep', '尼泊尔语', ['Nepali']), ('pap', '帕皮阿门托语', ['Papiamento', 'Papiamentu']),
    ('pus', '普什图语', ['Pashto', 'Pashtu']), ('uzb', '乌兹别克语', ['Uzbek', 'Uzbeki']),
    ('tuk', '土库曼语', ['Turkmen', 'Turkmani']), ('bal', '俾路支语', ['Balochi', 'Baluchi']),
    ('sqi', '阿尔巴尼亚语', ['Albanian']), ('ell', '希腊语', ['Greek']),
    ('bos', '波斯尼亚语', ['Bosnian']), ('srp', '塞尔维亚语', ['Serbian']),
    ('hrv', '克罗地亚语', ['Croatian']), ('ces', '捷克语', ['Czech']),
    ('fao', '法罗语', ['Faroese']), ('mya', '缅甸语', ['Burmese']),
    ('cnr', '黑山语', ['Montenegrin']), ('nob', '挪威语（书面语）', ['Bokmal Norwegian']),
    ('nno', '挪威语（新挪威语）', ['Nynorsk Norwegian']), ('swe', '瑞典语', ['Swedish']),
    ('ron', '罗马尼亚语', ['Romanian', 'Moldovan/Romanian']), ('slk', '斯洛伐克语', ['Slovak']),
    ('hun', '匈牙利语', ['Hungarian']), ('slv', '斯洛文尼亚语', ['Slovene', 'Slovenian']),
    ('dan', '丹麦语', ['Danish']), ('fin', '芬兰语', ['Finnish']), ('isl', '冰岛语', ['Icelandic']),
    ('bul', '保加利亚语', ['Bulgarian']), ('lit', '立陶宛语', ['Lithuanian']),
    ('lav', '拉脱维亚语', ['Latvian']), ('est', '爱沙尼亚语', ['Estonian']),
    ('hye', '亚美尼亚语', ['Armenian']), ('kat', '格鲁吉亚语', ['Georgian']),
    ('aze', '阿塞拜疆语', ['Azerbaijani']), ('kaz', '哈萨克语', ['Kazakh']),
    ('kir', '吉尔吉斯语', ['Kyrgyz']), ('tgk', '塔吉克语', ['Tajik']),
    ('heb', '希伯来语', ['Hebrew']), ('kur', '库尔德语', ['Kurdish']),
    ('khm', '高棉语', ['Khmer']), ('lao', '老挝语', ['Lao']), ('mon', '蒙古语', ['Mongolian']),
    ('tgl', '他加禄语', ['Tagalog']), ('ceb', '宿务语', ['Cebuano']),
    ('ilo', '伊洛卡诺语', ['Ilocano']), ('hil', '希利盖农语', ['Hiligaynon/Ilonggo']),
    ('mar', '马拉地语', ['Marathi']), ('tel', '泰卢固语', ['Telugu']),
    ('guj', '古吉拉特语', ['Gujarati']), ('kan', '卡纳达语', ['Kannada']),
    ('ory', '奥里亚语', ['Odia']), ('mal', '马拉雅拉姆语', ['Malayalam']),
    ('pan', '旁遮普语', ['Punjabi', 'Panjabi']), ('asm', '阿萨姆语', ['Assamese']),
    ('mai', '迈蒂利语', ['Maithili', 'Maithali']), ('sin', '僧伽罗语', ['Sinhala']),
    ('dzo', '宗喀语', ['Dzongkha']), ('ton', '汤加语', ['Tongan']),
    ('mah', '马绍尔语', ['Marshallese']), ('smo', '萨摩亚语', ['Samoan']),
    ('cat', '加泰罗尼亚语', ['Catalan']), ('bel', '白俄罗斯语', ['Belarusian']),
    ('mkd', '马其顿语', ['Macedonian']), ('som', '索马里语', ['Somali']),
    ('lat', '拉丁语', ['Latin']), ('yue', '粤语', ['Cantonese', 'Yue']),
]

def normalize_label(label):
    return re.sub(r'\s+', ' ', label).strip().casefold()

LABEL_INDEX = {normalize_label(alias): (identifier, name) for identifier, name, aliases in LABELS for alias in aliases}

def split_entries(text):
    """Only commas/semicolons outside parentheses separate source entries."""
    entries, start, depth = [], 0, 0
    for index, char in enumerate(text):
        if char == '(':
            depth += 1
        elif char == ')':
            depth = max(0, depth - 1)
        elif char in ',;' and depth == 0:
            if text[start:index].strip():
                entries.append(text[start:index].strip())
            start = index + 1
    if text[start:].strip():
        entries.append(text[start:].strip())
    return entries

def parse_languages(text):
    entries = split_entries(text)
    languages, untranslated, seen = [], [], set()
    for entry in entries:
        label = entry
        for _ in range(8):
            label = re.sub(r'\([^()]*\)', '', label)
        # Strip a terminal statistical share, never a phrase joining several languages.
        label = re.sub(r'\s+(?:less than\s+)?[<>]?\s*\d+(?:\.\d+)?\s*%\s*$', '', label).strip()
        label = re.sub(r'\s+only$', '', label).strip()
        match = LABEL_INDEX.get(normalize_label(label))
        if match:
            identifier, name = match
            if identifier not in seen:
                languages.append({'id': identifier, 'name': name, 'sourceLabel': entry,
                                  'status': '历史资料所列语言，不表示法定地位或使用比例'})
                seen.add(identifier)
            else:
                untranslated.append(entry)
        elif not re.fullmatch(r'(?:other|unspecified|unknown|none|no answer|no response|undeclared or unknown)', label, re.I):
            # Unknown names and mixed statements remain visible verbatim. Do not infer a language ID.
            untranslated.append(entry)
    return languages, untranslated, entries
