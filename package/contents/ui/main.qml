// SPDX-License-Identifier: GPL-3.0-or-later
pragma ComponentBehavior: Bound

import QtCore
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid // qmllint disable import

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

    fullRepresentation: StickyNote {
        noteId: root.noteId
        notesDirUrl: root.notesDirUrl
    }
}
// qmllint enable import unresolved-type unqualified missing-property
