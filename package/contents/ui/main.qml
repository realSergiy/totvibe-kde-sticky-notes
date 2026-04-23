// SPDX-License-Identifier: GPL-3.0-or-later
pragma ComponentBehavior: Bound

import QtCore
import QtQuick
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.plasma.core as PlasmaCore // qmllint disable import
import org.kde.plasma.plasmoid // qmllint disable import
import "../js/io.mjs" as Io

// qmllint disable import unresolved-type unqualified missing-property
PlasmoidItem {
    id: root

    readonly property string noteId: Plasmoid.configuration.noteId
    readonly property url notesDirUrl: StandardPaths.writableLocation(StandardPaths.GenericDataLocation) + "/totvibe-stickynotes/notes"

    Layout.minimumWidth: 160
    Layout.minimumHeight: 120
    Layout.preferredWidth: 240
    Layout.preferredHeight: 200

    preferredRepresentation: fullRepresentation

    Plasmoid.contextualActions: [
        PlasmaCore.Action {
            text: "Delete this note"
            icon.name: "edit-delete"
            enabled: root.noteId.length > 0
            onTriggered: deleteDialog.open()
        }
    ]

    fullRepresentation: StickyNote {
        noteId: root.noteId
        notesDirUrl: root.notesDirUrl
        onExternallyDeleted: root.visible = false
    }

    function persistGeometry() {
        if (root.noteId.length === 0) {
            return;
        }
        Io.upsertPosition(root.notesDirUrl.toString(), root.noteId, {
            "x": root.x,
            "y": root.y,
            "width": root.width,
            "height": root.height
        });
    }

    Timer {
        id: positionsDebounce

        interval: 500
        repeat: false
        onTriggered: root.persistGeometry()
    }

    onXChanged: positionsDebounce.restart()
    onYChanged: positionsDebounce.restart()
    onWidthChanged: positionsDebounce.restart()
    onHeightChanged: positionsDebounce.restart()

    Component.onCompleted: {
        if (root.noteId.length === 0) {
            return;
        }
        Io.readPositions(root.notesDirUrl.toString()).then(function (map) {
            const g = map[root.noteId];
            if (!g) {
                return;
            }
            root.Layout.preferredWidth = g.width;
            root.Layout.preferredHeight = g.height;
        });
    }

    Component.onDestruction: {
        if (positionsDebounce.running) {
            positionsDebounce.stop();
        }
        root.persistGeometry();
    }

    Kirigami.PromptDialog {
        id: deleteDialog

        title: "Delete this note?"
        subtitle: "This will remove it from the desktop and erase its file."
        standardButtons: Kirigami.Dialog.Cancel
        customFooterActions: [
            Kirigami.Action {
                text: "Delete"
                icon.name: "edit-delete"
                onTriggered: {
                    Io.deleteNote(root.notesDirUrl.toString(), root.noteId);
                    Io.removePosition(root.notesDirUrl.toString(), root.noteId);
                    root.visible = false;
                    deleteDialog.close();
                }
            }
        ]
    }
}
// qmllint enable import unresolved-type unqualified missing-property
