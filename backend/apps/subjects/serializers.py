from rest_framework import serializers
from .models import Subject
from apps.classes.models import Classe


class SubjectSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    classe_name = serializers.SerializerMethodField()
    # Classe optionnelle : une matière peut être « générale » (sans classe).
    classe = serializers.PrimaryKeyRelatedField(
        queryset=Classe.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = Subject
        fields = ['id', 'name', 'coefficient', 'teacher', 'teacher_name', 'classe', 'classe_name']
        # On retire le UniqueTogetherValidator auto (name, classe) qui rendrait
        # `classe` obligatoire ; l'unicité reste garantie au niveau base de données.
        validators = []

    def get_teacher_name(self, obj):
        if obj.teacher:
            return obj.teacher.full_name
        return None

    def get_classe_name(self, obj):
        return obj.classe.name if obj.classe else None

    def validate(self, attrs):
        # Empêche de créer deux fois la même matière (même nom + même classe,
        # ou même nom au niveau général). Insensible à la casse. Gère aussi le
        # cas classe=null, non couvert par la contrainte unique en base.
        name = attrs.get('name') or getattr(self.instance, 'name', None)
        classe = attrs.get('classe', getattr(self.instance, 'classe', None))
        qs = Subject.objects.filter(name__iexact=(name or '').strip(), classe=classe)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            emplacement = f"dans la classe « {classe.name} »" if classe else "au niveau général"
            raise serializers.ValidationError(
                {'name': f"La matière « {name} » existe déjà {emplacement}."}
            )
        return attrs
