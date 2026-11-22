#!/usr/bin/env python3
"""Builds the ready-made "Log payment" Shortcut (unsigned).

    python3 tools/make-shortcut.py   →   shortcut/log-payment-unsigned.shortcut

setup.sh signs the result on your Mac (`shortcuts sign --mode anyone`) into
web/log-payment.shortcut, which the app offers under Settings → Apple Pay Shortcut.

The file holds no personal data: the first action is an empty Text field that the
Shortcuts app fills in when someone installs it (an "import question" asking for their
personal link). What the Shortcut does:

  1. Text: <your personal link>                       (asked for when installing)
  2. POST JSON {amount, merchant, card, name, raw} from the Wallet payment
  3. title = result["title"], items = result["items"]
  4. Choose from List (items, prompt = title)
  5. POST JSON {choice}
  6. If the reply contains "https" → Open URLs (the "Edit or don't log" page)

On iOS 17–26 a Wallet automation runs it with "Run Shortcut" and Input = Shortcut Input.
"""
import plistlib
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'shortcut' / 'log-payment-unsigned.shortcut'
OBJ = '￼'  # the placeholder Shortcuts uses where a variable sits inside text


def uid(name):
    # fixed ids keep the file identical between runs, so setup.sh only re-signs when it really changes
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f'budget-app/log-payment/{name}')).upper()


def output(name, action_uuid):
    return {'OutputName': name, 'OutputUUID': action_uuid, 'Type': 'ActionOutput'}


def payment(prop=None):
    """The Wallet payment handed to this Shortcut, or one of its fields."""
    v = {'Type': 'ExtensionInput'}
    if prop:
        v['Aggrandizements'] = [{'Type': 'WFPropertyVariableAggrandizement', 'PropertyName': prop}]
    return v


def tokens(value):
    """A text field holding just one variable."""
    return {'Value': {'string': OBJ, 'attachmentsByRange': {'{0, 1}': value}},
            'WFSerializationType': 'WFTextTokenString'}


def plain(s):
    return {'Value': {'string': s}, 'WFSerializationType': 'WFTextTokenString'}


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def json_body(fields):
    return {'Value': {'WFDictionaryFieldValueItems': [
        {'WFItemType': 0, 'WFKey': plain(k), 'WFValue': tokens(v)} for k, v in fields]},
        'WFSerializationType': 'WFDictionaryFieldValue'}


def action(identifier, **params):
    return {'WFWorkflowActionIdentifier': f'is.workflow.actions.{identifier}',
            'WFWorkflowActionParameters': params}


link, post1, items, title, chosen, post2, group, endif = (uid(n) for n in ('link', 'post1', 'items', 'title', 'chosen', 'post2', 'if', 'endif'))
LINK = output('Text', link)

actions = [
    action('gettext', UUID=link, WFTextActionText=''),
    action('downloadurl', UUID=post1, WFURL=tokens(LINK), WFHTTPMethod='POST', WFHTTPBodyType='JSON', ShowHeaders=True,
           WFJSONValues=json_body([
               ('amount', payment('Amount')),
               ('merchant', payment('Merchant')),
               ('card', payment('Card')),
               ('name', payment('Name')),
               ('raw', payment()),
           ])),
    action('getvalueforkey', UUID=items, WFGetDictionaryValueType='Value', WFDictionaryKey='items',
           WFInput=attachment(output('Contents of URL', post1))),
    action('getvalueforkey', UUID=title, WFGetDictionaryValueType='Value', WFDictionaryKey='title',
           WFInput=attachment(output('Contents of URL', post1))),
    action('choosefromlist', UUID=chosen, WFInput=attachment(output('Dictionary Value', items)),
           WFChooseFromListActionPrompt=tokens(output('Dictionary Value', title)),
           WFChooseFromListActionSelectMultiple=False),
    action('downloadurl', UUID=post2, WFURL=tokens(LINK), WFHTTPMethod='POST', WFHTTPBodyType='JSON', ShowHeaders=True,
           WFJSONValues=json_body([('choice', output('Chosen Item', chosen))])),
    action('conditional', GroupingIdentifier=group, WFControlFlowMode=0, WFCondition=99,
           WFConditionalActionString='https',
           WFInput={'Type': 'Variable', 'Variable': attachment(output('Contents of URL', post2))}),
    action('openurl', WFInput=attachment(output('Contents of URL', post2))),
    action('conditional', GroupingIdentifier=group, WFControlFlowMode=2, UUID=endif),
]

shortcut = {
    'WFWorkflowActions': actions,
    'WFWorkflowClientVersion': '2106.0.3',  # iOS 17, so older iPhones open it without a warning
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {'WFWorkflowIconGlyphNumber': 59719, 'WFWorkflowIconStartColor': 463140863},
    'WFWorkflowImportQuestions': [{
        'ActionIndex': 0,
        'Category': 'Parameter',
        'ParameterKey': 'WFTextActionText',
        'Text': 'Paste your personal link. It was copied when you tapped Install in the Budget app (Settings → Apple Pay Shortcut).',
        'DefaultValue': '',
    }],
    'WFWorkflowInputContentItemClasses': [
        'WFAppContentItem', 'WFAppStoreAppContentItem', 'WFArticleContentItem', 'WFContactContentItem',
        'WFDateContentItem', 'WFEmailAddressContentItem', 'WFFolderContentItem', 'WFGenericFileContentItem',
        'WFImageContentItem', 'WFiTunesProductContentItem', 'WFLocationContentItem', 'WFDCMapsLinkContentItem',
        'WFAVAssetContentItem', 'WFPDFContentItem', 'WFPhoneNumberContentItem', 'WFRichTextContentItem',
        'WFSafariWebPageContentItem', 'WFStringContentItem', 'WFDictionaryContentItem', 'WFNumberContentItem',
        'WFURLContentItem',
    ],
    'WFWorkflowOutputContentItemClasses': [],
    'WFWorkflowTypes': [],
    'WFQuickActionSurfaces': [],
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowHasOutputFallback': False,
}

if __name__ == '__main__':
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_bytes(plistlib.dumps(shortcut, fmt=plistlib.FMT_XML, sort_keys=True))
    print(f'Wrote {OUT}')
