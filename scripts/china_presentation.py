"""Project display conventions; original identifiers and statistics stay traceable."""
from shapely import normalize
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

CHINA_REGIONS = {
    'country-twn': ('中国台湾', 'Taiwan, China', ['台湾', '台湾地区', '中国台湾', 'Taiwan']),
    'country-hkg': ('中国香港', 'Hong Kong, China', ['香港', '香港特别行政区', '中国香港', 'Hong Kong']),
    'country-mac': ('中国澳门', 'Macao, China', ['澳门', '澳门特别行政区', '中国澳门', 'Macau', 'Macao']),
}
CHINA_IDS = ['country-chn', *CHINA_REGIONS]
PRESENTATION_NOTE = '项目采用中国地理学习口径，台湾、香港、澳门归属中国；保留原始要素ID与分列统计口径，不将来源中的地区代码解释为独立国家。'
STATISTICS_NOTES = {
    'country-chn': '本条沿用来源的中国大陆统计口径；台湾、香港、澳门资料按原来源分列，不将局部统计冒充全国合计。',
    'country-twn': '中国台湾地区资料，沿用来源的统计范围与年份；地区分列不表示国家归属。',
    'country-hkg': '中国香港特别行政区资料，沿用来源的统计范围与年份。',
    'country-mac': '中国澳门特别行政区资料，沿用来源的统计范围与年份。',
}


def country_properties(p):
    """Normalize a public display record without removing source names or IDs."""
    key = p.get('id') or p.get('countryId')
    if key not in CHINA_IDS:
        return p
    p['parentCountryId'] = 'country-chn'
    p['parentCountryName'] = '中国'
    p['statisticsScopeNote'] = STATISTICS_NOTES[key]
    if key in CHINA_REGIONS:
        zh, en, aliases = CHINA_REGIONS[key]
        p.setdefault('sourceName', p.get('name'))
        if 'nameEn' in p:
            p.setdefault('sourceNameEn', p['nameEn'])
            p['nameEn'] = en
        p['name'] = zh
        if 'aliases' in p:
            p['aliases'] = aliases
        if 'kind' in p:
            p['kind'] = 'region'
            p['adminLevel'] = 1
            if 'subkind' in p:
                p.setdefault('sourceSubkind', p['subkind'])
                p['subkind'] = '中国地区资料参考范围'
            p['geometryNote'] = '中国地区资料的概化参考范围，沿用来源中的统计单元；台湾省、台湾岛与台湾地区统计范围分别说明，地区单独记录不表示独立国家。' if key == 'country-twn' else '中国特别行政区的概化参考范围；地区资料按原来源分列，不表示独立国家。'
    return p


def country_features(features):
    """China's country outline includes all four existing source components."""
    by_id = {f['properties']['id']: f for f in features}
    assert all(key in by_id for key in CHINA_IDS)
    p = by_id['country-chn']['properties']
    # Keep the source mainland footprint for thematic statistics; a national
    # outline must never extend mainland-only percentages over Taiwan or HK/MO.
    p.setdefault('statisticsGeometry', by_id['country-chn']['geometry'])
    geom = normalize(unary_union([shape(p['statisticsGeometry']), *[shape(by_id[key]['geometry']) for key in CHINA_REGIONS]]))
    assert geom.is_valid and not geom.is_empty
    by_id['country-chn']['geometry'] = mapping(geom)
    p['bbox'] = [round(v, 4) for v in geom.bounds]
    p['geometrySourceIds'] = CHINA_IDS
    p['geometryNote'] = '中国参考轮廓合并Natural Earth原有中国大陆、台湾、香港、澳门几何；原始地区ID保留用于分列资料，概化海岸与小岛覆盖不作为法定界线。'
    for feature in features:
        country_properties(feature['properties'])
    return features


def city_properties(p):
    """Regional centres in Taiwan/Hong Kong/Macao are not national capitals."""
    source_country = p.get('sourceCountry', p.get('country', ''))
    source_regions = {
        'Taiwan': '台湾',
        'Hong Kong': '香港特别行政区',
        'Hong Kong S.A.R.': '香港特别行政区',
        'Hong Kong S.A.R': '香港特别行政区',
        'Macau': '澳门特别行政区',
        'Macao': '澳门特别行政区',
        'Macau S.A.R': '澳门特别行政区',
        'Macau S.A.R.': '澳门特别行政区',
        'Macao S.A.R': '澳门特别行政区',
        'Macao S.A.R.': '澳门特别行政区',
    }
    if source_country not in source_regions:
        return p
    p['sourceCountry'] = source_country
    p['sourceCapital'] = p.get('sourceCapital', p.get('capital', False))
    p['country'] = '中国'
    p['parentCountryId'] = 'country-chn'
    p['regionName'] = source_regions[source_country]
    p['capital'] = False
    p['minZoom'] = 2.5 if p.get('rank', 10) <= 2 else 3.5 if p.get('rank', 10) <= 4 else 5
    return p
