// SPDX-License-Identifier: GPL-3.0-or-later
pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import "../js/io.mjs" as Io

// qmllint disable missing-property
Rectangle {
    id: stickyNote

    property string noteId: ""
    property url notesDirUrl: ""
    property string content: ""
    property string mode: "view" // "view" | "edit"
    property bool missing: true
    property bool staleExternal: false
    readonly property int pollIntervalMs: 2000

    signal saved
    signal externallyDeleted

    color: "#FFF8B8"
    border.color: "#E8DC8A"
    border.width: 1
    radius: 6

    FontLoader {
        id: caveat

        source: "../fonts/Caveat-Regular.ttf"
    }

    function reload() {
        if (!stickyNote.noteId || stickyNote.notesDirUrl.toString().length === 0) {
            stickyNote.missing = true;
            stickyNote.content = "";
            return;
        }
        Io.readNote(stickyNote.notesDirUrl.toString(), stickyNote.noteId).then(function (note) {
            stickyNote.content = note.content;
            stickyNote.missing = note.missing;
            stickyNote.staleExternal = false;
            if (!note.missing && note.content === "" && stickyNote.mode === "view") {
                stickyNote.enterEdit();
            }
        });
    }

    function enterEdit() {
        if (stickyNote.missing) {
            return;
        }
        editor.text = stickyNote.content;
        stickyNote.mode = "edit";
        editor.cursorPosition = editor.text.length;
        editor.forceActiveFocus();
    }

    function commit() {
        if (stickyNote.mode !== "edit") {
            return;
        }
        const text = editor.text;
        stickyNote.content = text;
        stickyNote.mode = "view";
        stickyNote.staleExternal = false;
        Io.writeNote(stickyNote.notesDirUrl.toString(), stickyNote.noteId, text).then(function () {
            stickyNote.saved();
        });
    }

    function discardEdit() {
        stickyNote.mode = "view";
        stickyNote.staleExternal = false;
        stickyNote.reload();
    }

    onNoteIdChanged: stickyNote.reload()
    onNotesDirUrlChanged: stickyNote.reload()
    Component.onCompleted: stickyNote.reload()
    Component.onDestruction: {
        if (stickyNote.mode === "edit" && !stickyNote.missing) {
            Io.writeNoteSync(stickyNote.notesDirUrl.toString(), stickyNote.noteId, editor.text);
        }
    }

    StackLayout {
        anchors.fill: parent
        anchors.margins: 12
        currentIndex: stickyNote.mode === "edit" ? 1 : 0

        TextEdit {
            id: viewer

            color: "#1F3A93"
            font.family: caveat.name
            font.pixelSize: Math.round(16 * Kirigami.Theme.defaultFont.pixelSize / 14)
            readOnly: true
            selectByMouse: false
            text: stickyNote.missing ? "" : stickyNote.content
            textFormat: TextEdit.MarkdownText
            wrapMode: TextEdit.Wrap
        }

        ScrollView {
            TextArea {
                id: editor

                background: null
                color: "#1F3A93"
                font.family: caveat.name
                font.pixelSize: Math.round(16 * Kirigami.Theme.defaultFont.pixelSize / 14)
                wrapMode: TextEdit.Wrap

                Keys.onEscapePressed: stickyNote.commit()
                onActiveFocusChanged: {
                    if (!activeFocus && stickyNote.mode === "edit") {
                        stickyNote.commit();
                    }
                }
            }
        }
    }

    MouseArea {
        anchors.fill: parent
        enabled: stickyNote.mode === "view" && !stickyNote.missing
        onClicked: stickyNote.enterEdit()
    }

    Rectangle {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 4
        color: "#FFE082"
        height: badge.implicitHeight + 4
        radius: 4
        visible: stickyNote.staleExternal && stickyNote.mode === "edit"
        width: badge.implicitWidth + 8

        Label {
            id: badge

            anchors.centerIn: parent
            font.pixelSize: 11
            text: "file changed externally — Esc to keep edits, click to discard"
        }

        MouseArea {
            anchors.fill: parent
            onClicked: stickyNote.discardEdit()
        }
    }

    Timer {
        interval: stickyNote.pollIntervalMs
        repeat: true
        running: stickyNote.noteId.length > 0
        onTriggered: {
            if (stickyNote.notesDirUrl.toString().length === 0) {
                return;
            }
            Io.readNote(stickyNote.notesDirUrl.toString(), stickyNote.noteId).then(function (note) {
                if (note.missing) {
                    if (!stickyNote.missing) {
                        stickyNote.missing = true;
                        stickyNote.externallyDeleted();
                    }
                    return;
                }
                if (note.content === stickyNote.content) {
                    return;
                }
                if (stickyNote.mode === "view") {
                    stickyNote.content = note.content;
                } else {
                    stickyNote.staleExternal = true;
                }
            });
        }
    }
}
// qmllint enable missing-property
