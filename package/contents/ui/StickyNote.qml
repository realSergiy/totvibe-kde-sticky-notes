// SPDX-License-Identifier: GPL-3.0-or-later
import QtQuick
import org.kde.kirigami as Kirigami
import "../js/bootstrap.mjs" as Bootstrap
import "../js/palette.mjs" as Palette

Rectangle {
    id: stickyNote

    property string noteId: ""
    property url notesDirUrl: ""
    property string content: ""
    property bool missing: true

    readonly property string placeholderText: "No note bound — set Plasmoid.configuration.noteId manually or wait for TIP 5 gallery-create wiring."

    color: Palette.PALETTE.background
    border.color: Palette.PALETTE.border
    border.width: 1
    radius: 6

    FontLoader {
        id: caveat

        source: "../fonts/Caveat-Regular.ttf"
    }

    function reload() {
        // qmllint disable missing-property
        Bootstrap.loadBoundNote(stickyNote.notesDirUrl.toString(), stickyNote.noteId).then(function (note) {
            stickyNote.content = note.content;
            stickyNote.missing = note.missing;
        });
    // qmllint enable missing-property
    }

    onNoteIdChanged: reload()
    onNotesDirUrlChanged: reload()
    Component.onCompleted: reload()

    TextEdit {
        id: body

        anchors.fill: parent
        anchors.margins: 12
        color: Palette.PALETTE.text
        font.family: caveat.name
        font.pixelSize: Math.round(16 * Kirigami.Theme.defaultFont.pixelSize / 14)
        readOnly: true
        selectByMouse: true
        text: stickyNote.missing ? stickyNote.placeholderText : stickyNote.content
        textFormat: TextEdit.MarkdownText
        wrapMode: TextEdit.Wrap
    }
}
