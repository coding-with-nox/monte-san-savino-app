{{- define "miniatures-contest-backend.name" -}}
miniatures-contest-backend
{{- end -}}

{{- define "miniatures-contest-backend.fullname" -}}
{{ .Release.Name }}-{{ include "miniatures-contest-backend.name" . }}
{{- end -}}
